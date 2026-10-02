import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_CAP_MS,
  CMD_SPACING_MS,
  ConfigSyncWatchdog,
  HARD_CAP_MS,
  IDLE_TIMEOUT_MS,
  MAX_RETRY_ROUNDS,
  REQUIRED_TYPES,
  RETRY_IDLE_MS,
  SyncProgress,
} from "./ConfigSyncWatchdog";

const NEW_FW = "4.35 v";
const OLD_FW = "C 4.29 d";

function setup() {
  const wd = new ConfigSyncWatchdog();
  const sendCmd = vi.fn(async (_cmd: string) => {});
  const resendHello = vi.fn(async () => {});
  const onFail = vi.fn();
  const onComplete = vi.fn();
  const progress: SyncProgress[] = [];
  const onProgress = vi.fn((p: SyncProgress) => progress.push(p));
  wd.start({ sendCmd, resendHello, onFail, onComplete, onProgress });
  return { wd, sendCmd, resendHello, onFail, onComplete, onProgress, progress };
}

// the node sends all required config JSONs (except the given ones)
function sendConfig(wd: ConfigSyncWatchdog, except: string[] = []) {
  REQUIRED_TYPES.filter((t) => !except.includes(t)).forEach((t) => {
    wd.noteActivity();
    wd.noteType(t, t === "I" ? NEW_FW : undefined);
  });
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ConfigSyncWatchdog", () => {
  it("completes without any request if everything arrives", async () => {
    const { wd, sendCmd, resendHello, onFail, onComplete } = setup();
    sendConfig(wd);
    expect(onComplete).not.toHaveBeenCalled(); // CONFFIN still missing
    wd.noteActivity();
    wd.noteType("CONFFIN");
    expect(onComplete).toHaveBeenCalledTimes(1);
    await advance(HARD_CAP_MS);
    expect(sendCmd).not.toHaveBeenCalled();
    expect(resendHello).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(wd.isRunning()).toBe(false);
  });

  it("does not time out on a long dump while frames keep arriving", async () => {
    const { wd, sendCmd, onFail, onComplete } = setup();
    sendConfig(wd);
    // 100 s of mheard / text frames, one every 400 ms
    for (let t = 0; t < 100000; t += 400) {
      wd.noteActivity();
      await advance(400);
    }
    expect(sendCmd).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    wd.noteType("CONFFIN");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("requests a missing type after the idle timeout, shared commands only once", async () => {
    const { wd, sendCmd, onFail } = setup();
    sendConfig(wd, ["SA", "IS1", "I"]);
    // "I" and "IS1" both come from --info, so only one --info is expected
    await advance(IDLE_TIMEOUT_MS);
    // version unknown (I missing) -> the first request is the --info probe only
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info"]);
    wd.noteActivity();
    wd.noteType("I", NEW_FW);
    wd.noteType("IS1");
    await advance(IDLE_TIMEOUT_MS + CMD_SPACING_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info", "--aprsset", "--conffin"]);
    wd.noteType("SA");
    wd.noteType("CONFFIN");
    expect(onFail).not.toHaveBeenCalled();
  });

  it("sends the commands one after the other with spacing", async () => {
    const { wd, sendCmd } = setup();
    sendConfig(wd, ["SA", "G", "W"]);
    wd.noteType("CONFFIN"); // CONFFIN is there, config is not -> round starts right away
    await advance(0);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--aprsset"]);
    await advance(CMD_SPACING_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--aprsset", "--pos"]);
    await advance(CMD_SPACING_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--aprsset", "--pos", "--wx"]);
  });

  it("requests CONFFIN if the config is complete but CONFFIN is missing", async () => {
    const { wd, sendCmd, onComplete } = setup();
    sendConfig(wd);
    await advance(IDLE_TIMEOUT_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--conffin"]);
    wd.noteType("CONFFIN");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fails after the max retry rounds with the list of missing types", async () => {
    const { wd, sendCmd, onFail, onComplete } = setup();
    sendConfig(wd, ["SA"]);
    await advance(IDLE_TIMEOUT_MS + CMD_SPACING_MS); // round 1: --aprsset, --conffin
    expect(sendCmd).toHaveBeenCalledTimes(2);
    await advance(CMD_SPACING_MS + RETRY_IDLE_MS); // round 2
    expect(sendCmd).toHaveBeenCalledTimes(4);
    expect(onFail).not.toHaveBeenCalled();
    await advance(CMD_SPACING_MS + RETRY_IDLE_MS); // nothing came -> fail
    expect(MAX_RETRY_ROUNDS).toBe(2);
    expect(sendCmd).toHaveBeenCalledTimes(4);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(["SA", "CONFFIN"]);
    expect(onComplete).not.toHaveBeenCalled();
    expect(wd.isRunning()).toBe(false);
  });

  it("starts a round at once if CONFFIN arrives and config is missing", async () => {
    const { wd, sendCmd } = setup();
    sendConfig(wd, ["SN1"]);
    wd.noteType("CONFFIN");
    await advance(0);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--nodeset"]);
  });

  it("sends the hello once again if nothing at all was received, then fails", async () => {
    const { wd, sendCmd, resendHello, onFail } = setup();
    await advance(IDLE_TIMEOUT_MS);
    expect(resendHello).toHaveBeenCalledTimes(1);
    expect(sendCmd).not.toHaveBeenCalled();
    await advance(IDLE_TIMEOUT_MS); // still silent -> version probe
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info"]);
    await advance(RETRY_IDLE_MS);
    expect(resendHello).toHaveBeenCalledTimes(1);
    await advance(10 * CMD_SPACING_MS + RETRY_IDLE_MS);
    await advance(10 * CMD_SPACING_MS + RETRY_IDLE_MS);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(wd.isRunning()).toBe(false);
  });

  it("sends the hello once again if only live frames (mheard, text) arrive but no config", async () => {
    const { wd, resendHello, sendCmd } = setup();
    wd.noteActivity(); // live mheard frame
    await advance(IDLE_TIMEOUT_MS);
    expect(resendHello).toHaveBeenCalledTimes(1);
    expect(sendCmd).not.toHaveBeenCalled();
  });

  it("does not watch firmware older than 4.35", async () => {
    const { wd, sendCmd, onFail, onComplete } = setup();
    wd.noteActivity();
    wd.noteType("I", OLD_FW);
    expect(wd.isRunning()).toBe(false);
    wd.noteType("CONFFIN");
    await advance(HARD_CAP_MS);
    expect(sendCmd).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("stop() ends everything: no more commands or callbacks", async () => {
    const { wd, sendCmd, onFail, onComplete } = setup();
    sendConfig(wd, ["SA", "G", "W"]);
    wd.noteType("CONFFIN");
    await advance(0);
    expect(sendCmd).toHaveBeenCalledTimes(1);
    wd.stop();
    await advance(HARD_CAP_MS);
    expect(sendCmd).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("fails if the app stays in the background longer than the cap", async () => {
    const { wd, onFail } = setup();
    sendConfig(wd);
    wd.setAppActive(false);
    // the idle timer still runs in the background and requests --conffin, but the cap ends it
    await advance(BACKGROUND_CAP_MS);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(["CONFFIN"]);
  });

  it("fails on resume if timers were paused in the background", () => {
    const { wd, onFail } = setup();
    sendConfig(wd);
    wd.setAppActive(false);
    vi.setSystemTime(Date.now() + BACKGROUND_CAP_MS + 1000); // clock moved on, timers did not run
    wd.setAppActive(true);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("survives a short stay in the background and completes", async () => {
    const { wd, onFail, onComplete } = setup();
    sendConfig(wd);
    wd.setAppActive(false);
    await advance(5000);
    wd.setAppActive(true);
    wd.noteType("CONFFIN");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("reports progress", async () => {
    const { wd, progress } = setup();
    expect(progress[0]).toMatchObject({ phase: "initial", received: 0, total: REQUIRED_TYPES.length });
    wd.noteActivity();
    wd.noteType("SA");
    wd.noteType("G");
    expect(progress[progress.length - 1]).toMatchObject({ phase: "initial", received: 2 });
    expect(progress[progress.length - 1].missing).not.toContain("SA");
    await advance(IDLE_TIMEOUT_MS);
    const retry = progress.find((p) => p.phase === "retry");
    expect(retry).toMatchObject({ action: "request", maxRounds: MAX_RETRY_ROUNDS });
    wd.stop();
    expect(progress[progress.length - 1]).toMatchObject({ phase: "done", outcome: "stopped" });
  });

  it("reports the outcome of the sync", () => {
    const ok = setup();
    sendConfig(ok.wd);
    ok.wd.noteType("CONFFIN");
    expect(ok.progress[ok.progress.length - 1]).toMatchObject({ phase: "done", outcome: "complete", received: REQUIRED_TYPES.length });
    const old = setup();
    old.wd.noteType("I", OLD_FW);
    expect(old.progress[old.progress.length - 1]).toMatchObject({ phase: "done", outcome: "stopped" });
  });

  it("reports a failed sync", async () => {
    const { progress } = setup();
    await advance(HARD_CAP_MS);
    expect(progress[progress.length - 1]).toMatchObject({ phase: "done", outcome: "failed" });
  });

  it("requests --pos and --wx after the sync if \"I\" came after G and W", async () => {
    const { wd, sendCmd, onComplete } = setup();
    sendConfig(wd, ["I"]);
    wd.noteType("CONFFIN");
    await advance(0);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info"]); // version probe
    wd.noteType("I", NEW_FW);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await advance(0);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info", "--pos"]);
    await advance(CMD_SPACING_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info", "--pos", "--wx"]);
  });

  it("does not request --pos / --wx again if \"I\" came first", async () => {
    const { wd, sendCmd } = setup();
    wd.noteType("I", NEW_FW);
    sendConfig(wd, ["I"]);
    wd.noteType("CONFFIN");
    await advance(HARD_CAP_MS);
    expect(sendCmd).not.toHaveBeenCalled();
  });

  it("stop() ends the requests after a late \"I\"", async () => {
    const { wd, sendCmd } = setup();
    sendConfig(wd, ["I"]);
    wd.noteType("CONFFIN");
    await advance(0);
    wd.noteType("I", NEW_FW);
    await advance(0);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info", "--pos"]);
    wd.stop(); // disconnect
    await advance(HARD_CAP_MS);
    expect(sendCmd.mock.calls.map((c) => c[0])).toEqual(["--info", "--pos"]);
  });
});
