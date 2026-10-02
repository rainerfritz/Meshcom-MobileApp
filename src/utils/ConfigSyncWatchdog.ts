// Watches the config sync the node starts after the BLE hello message.
//
// The node sends its config JSONs, then the MHeards and stored text messages and finally {"TYP":"CONFFIN"}.
// The stream has no counters, so the app has to know which JSON types it expects. If the stream stalls
// (no frame for IDLE_TIMEOUT_MS) the missing config is requested again with the text commands of the node.
// There is no fixed total timeout: as long as frames arrive the sync is alive (many MHeards can take a minute).
// If something is still missing after MAX_RETRY_ROUNDS the sync fails and onFail is called.
//
// Only firmware >= MIN_FW_VERSION sends the complete set of config JSONs, older nodes are not watched.

import { isFwOlderThan } from "./FwVersion";

// config JSON types (TYP) every watched firmware sends. IO, TM and AN are optional and not used by the app.
export const REQUIRED_TYPES = ["I", "IS1", "SE", "S1", "SW", "S2", "SN", "SN1", "SA", "G", "W"] as const;

// text command of the node that answers with the given JSON type (several types share one command)
const TYPE_TO_CMD: Record<string, string> = {
  I: "--info",
  IS1: "--info",
  SE: "--seset",
  S1: "--seset",
  SW: "--wifiset",
  S2: "--wifiset",
  SN: "--nodeset",
  SN1: "--nodeset",
  SA: "--aprsset",
  G: "--pos",
  W: "--wx",
};

const CMD_INFO = "--info";
const CMD_CONFFIN = "--conffin";
// G and W write the own position / weather to the DB only if the node callsign (from "I") is known.
// If "I" came after them they are requested again once the sync is complete.
const LATE_INFO_CMDS = ["--pos", "--wx"];

export const IDLE_TIMEOUT_MS = 10000;      // no frame for this long -> request the missing config
export const RETRY_IDLE_MS = 8000;         // wait for the answers of a retry round
export const MAX_RETRY_ROUNDS = 2;
export const CMD_SPACING_MS = 600;         // the node has only one slot for commands from the phone
export const HARD_CAP_MS = 150000;         // safety net for the time the app is in the foreground
export const BACKGROUND_CAP_MS = 180000;   // max time the sync may run after the app went to the background

export type SyncPhase = "initial" | "retry" | "done";
// how the sync ended, set with phase "done"
export type SyncOutcome = "complete" | "failed" | "stopped";

export interface SyncProgress {
  phase: SyncPhase;
  outcome?: SyncOutcome;
  action: "none" | "rehello" | "request";
  round: number;
  maxRounds: number;
  received: number;
  total: number;
  missing: string[];
}

export interface WatchdogOptions {
  sendCmd: (cmd: string) => Promise<void> | void;
  resendHello: () => Promise<void> | void;
  onFail: (missing: string[]) => void;
  // called when CONFFIN and all required config JSONs are there
  onComplete: () => void;
  onProgress?: (p: SyncProgress) => void;
}

export class ConfigSyncWatchdog {
  private static instance: ConfigSyncWatchdog;

  static getInstance() {
    if (!ConfigSyncWatchdog.instance) {
      ConfigSyncWatchdog.instance = new ConfigSyncWatchdog();
    }
    return ConfigSyncWatchdog.instance;
  }

  private opts: WatchdogOptions | null = null;
  private running = false;
  private runId = 0;
  private received = new Set<string>();
  private confFin = false;
  private round = 0;
  private rehelloDone = false;
  private probeDone = false;
  private fwKnown = false;
  private lateInfo = false;
  private postSeq = 0;
  private sending = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private hardTimer: ReturnType<typeof setTimeout> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private fgMs = 0;
  private fgSince = 0;
  private bgSince: number | null = null;

  isRunning() {
    return this.running;
  }

  start(opts: WatchdogOptions) {
    this.stopInternal();
    this.opts = opts;
    this.running = true;
    this.runId++;
    this.received.clear();
    this.confFin = false;
    this.round = 0;
    this.rehelloDone = false;
    this.probeDone = false;
    this.fwKnown = false;
    this.lateInfo = false;
    this.sending = false;
    this.fgMs = 0;
    this.fgSince = Date.now();
    this.bgSince = null;
    this.armHardTimer();
    this.armIdleTimer(IDLE_TIMEOUT_MS);
    this.emit("initial", "none");
  }

  // stops the watch without calling onFail / onComplete (disconnect, user cancel)
  stop() {
    this.postSeq++; // also ends the requests after a late "I"
    if (!this.running) return;
    this.stopInternal();
    this.emit("done", "none", this.opts, "stopped");
  }

  // any frame from the node (config, mheard, text, position) shows that the stream is alive
  noteActivity() {
    if (!this.running) return;
    if (!this.sending) this.armIdleTimer(this.round === 0 ? IDLE_TIMEOUT_MS : RETRY_IDLE_MS);
  }

  // a config JSON of type typ arrived. fwver is the FWVER of the node for the "I" JSON
  noteType(typ: string, fwver?: string) {
    if (!this.running) return;

    if (typ === "I" && fwver) {
      this.fwKnown = true;
      if (isFwOlderThan(fwver)) {
        // old firmware does not send the complete config, nothing to watch
        this.stop();
        return;
      }
    }

    if (typ === "I" && !this.received.has("I") && (this.received.has("G") || this.received.has("W"))) {
      this.lateInfo = true;
    }
    if ((REQUIRED_TYPES as readonly string[]).includes(typ)) this.received.add(typ);
    if (typ === "CONFFIN") this.confFin = true;

    if (this.isComplete()) {
      this.complete();
      return;
    }
    this.emit(this.round === 0 ? "initial" : "retry", "none");

    // CONFFIN is the last frame of the node, so what is missing now will not come on its own
    if (typ === "CONFFIN" && this.round === 0 && !this.sending) {
      this.startRound();
    }
  }

  // the app moves between foreground and background while the sync runs
  setAppActive(active: boolean) {
    if (!this.running) return;
    const now = Date.now();
    if (!active) {
      if (this.bgSince !== null) return;
      this.bgSince = now;
      this.fgMs += now - this.fgSince;
      this.clearTimer("hardTimer");
      this.bgTimer = setTimeout(() => this.fail(), BACKGROUND_CAP_MS);
    } else {
      if (this.bgSince === null) return;
      const bgFor = now - this.bgSince;
      this.bgSince = null;
      this.clearTimer("bgTimer");
      if (bgFor >= BACKGROUND_CAP_MS) {
        this.fail();
        return;
      }
      this.fgSince = now;
      this.armHardTimer();
    }
  }

  getMissing(): string[] {
    const missing: string[] = REQUIRED_TYPES.filter((t) => !this.received.has(t));
    if (!this.confFin) missing.push("CONFFIN");
    return missing;
  }

  private isComplete() {
    return this.confFin && REQUIRED_TYPES.every((t) => this.received.has(t));
  }

  private onIdle() {
    if (!this.running || this.sending) return;

    // no config JSON at all received: hello or notifications got lost, try the hello once more.
    // Live frames (mheard, text, position) do not count, they also arrive without the config dump.
    if (this.received.size === 0 && !this.confFin && !this.rehelloDone) {
      this.rehelloDone = true;
      this.emit("retry", "rehello");
      const id = this.runId;
      Promise.resolve()
        .then(() => this.opts?.resendHello())
        .catch((e) => console.log("ConfigSyncWatchdog: resend hello failed: " + e))
        .finally(() => {
          if (this.running && this.runId === id) this.armIdleTimer(IDLE_TIMEOUT_MS);
        });
      return;
    }

    if (this.round >= MAX_RETRY_ROUNDS) {
      this.fail();
      return;
    }
    this.startRound();
  }

  private async startRound() {
    if (!this.running) return;
    const id = this.runId;
    this.clearTimer("idleTimer");

    let cmds: string[];
    if (!this.fwKnown && !this.probeDone) {
      // version unknown: ask for the info only, the answer tells if the node is watched at all.
      // This probe does not count as a retry round.
      this.probeDone = true;
      cmds = [CMD_INFO];
    } else {
      this.round++;
      cmds = [];
      REQUIRED_TYPES.forEach((t) => {
        if (!this.received.has(t) && !cmds.includes(TYPE_TO_CMD[t])) cmds.push(TYPE_TO_CMD[t]);
      });
      if (!this.confFin) cmds.push(CMD_CONFFIN);
    }

    this.emit("retry", "request");
    this.sending = true;
    for (let i = 0; i < cmds.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, CMD_SPACING_MS));
      if (!this.running || this.runId !== id) return;
      try {
        await this.opts?.sendCmd(cmds[i]);
      } catch (e) {
        console.log("ConfigSyncWatchdog: sending " + cmds[i] + " failed: " + e);
      }
    }
    if (!this.running || this.runId !== id) return;
    this.sending = false;
    this.armIdleTimer(RETRY_IDLE_MS);
  }

  private complete() {
    const opts = this.opts;
    const lateInfo = this.lateInfo;
    this.stopInternal();
    this.emit("done", "none", opts, "complete");
    opts?.onComplete();
    if (lateInfo && opts) this.requestAfterLateInfo(opts);
  }

  // "I" (callsign) came after G / W: request them again so the own position and weather get into the DB
  private async requestAfterLateInfo(opts: WatchdogOptions) {
    const seq = ++this.postSeq;
    for (let i = 0; i < LATE_INFO_CMDS.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, CMD_SPACING_MS));
      if (this.postSeq !== seq) return;
      try {
        await opts.sendCmd(LATE_INFO_CMDS[i]);
      } catch (e) {
        console.log("ConfigSyncWatchdog: sending " + LATE_INFO_CMDS[i] + " failed: " + e);
      }
    }
  }

  private fail() {
    if (!this.running) return;
    const missing = this.getMissing();
    const opts = this.opts;
    this.stopInternal();
    this.emit("done", "none", opts, "failed");
    opts?.onFail(missing);
  }

  private emit(phase: SyncPhase, action: SyncProgress["action"], opts: WatchdogOptions | null = this.opts, outcome?: SyncOutcome) {
    if (!opts?.onProgress) return;
    opts.onProgress({
      phase,
      outcome,
      action,
      round: Math.max(this.round, 1),
      maxRounds: MAX_RETRY_ROUNDS,
      received: REQUIRED_TYPES.filter((t) => this.received.has(t)).length,
      total: REQUIRED_TYPES.length,
      missing: this.getMissing(),
    });
  }

  private armIdleTimer(ms: number) {
    this.clearTimer("idleTimer");
    this.idleTimer = setTimeout(() => this.onIdle(), ms);
  }

  private armHardTimer() {
    this.clearTimer("hardTimer");
    this.hardTimer = setTimeout(() => this.fail(), Math.max(HARD_CAP_MS - this.fgMs, 0));
  }

  private clearTimer(name: "idleTimer" | "hardTimer" | "bgTimer") {
    const t = this[name];
    if (t) clearTimeout(t);
    this[name] = null;
  }

  private stopInternal() {
    this.running = false;
    this.sending = false;
    this.runId++;
    this.clearTimer("idleTimer");
    this.clearTimer("hardTimer");
    this.clearTimer("bgTimer");
  }
}

export default ConfigSyncWatchdog;
