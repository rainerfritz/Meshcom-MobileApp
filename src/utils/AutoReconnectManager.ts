import ReconnectStore, { ReconnectResult } from "../store/ReconnectStore";
import LogS from "./LogService";

/**
 * Auto reconnect cycle after an unexpected BLE disconnect.
 *
 * A cycle always scans first. It connects only if the node is heard recently AND the signal is good enough,
 * otherwise a connect would likely drop again while it is set up. The manager does not touch BLE itself:
 * Connect.tsx registers two callbacks, probeFn (what does the live scan know about the node) and
 * connectFn (the silent connect). That keeps it free of stale closures and testable.
 */

export const REC_MIN_RSSI = -90;            // dBm, below that no connect is tried
export const REC_SEEN_MAX_AGE_MS = 10000;   // a scan hit older than this does not count as "in range" (some nodes advertise rarely)
export const REC_HIT_WINDOW_MS = 8000;      // adverts of the node are counted over this time (hit rate)
export const REC_MIN_HITS = 2;              // at least this many adverts in the window, else the link is too poor to connect
export const REC_MIN_DWELL_MS = 3000;       // the node has to be heard this long before the first connect (smoothed RSSI)
export const REC_GOOD_PROBES = 2;           // consecutive probes at or above REC_MIN_RSSI before we connect (hysteresis)
export const REC_POLL_MS = 1000;            // probe interval
export const REC_SEARCH_WINDOW_MS = 60000;  // max time of the search, and again from the first connect attempt on
export const REC_MAX_CONNECT_ATTEMPTS = 3;
export const REC_BACKOFF_MS = 2000;         // wait after a failed connect, multiplied by the attempt number
export const REC_FLAP_WINDOW_MS = 30000;    // a reconnected link that drops within this time counts as a flap
export const REC_FLAP_HISTORY_MS = 120000;  // flaps are counted over this time
export const REC_MAX_FLAPS = 3;

export interface ReconnectProbe {
    seenAgoMs: number;
    rssi: number;
    hits: number;       // adverts heard in the last REC_HIT_WINDOW_MS
}

/** adverts (arrival times) inside the hit window that ends at `now` */
export function advertHits(times: number[], now: number): number {
    let n = 0;
    for (const t of times) {
        if (now - t <= REC_HIT_WINDOW_MS) n++;
    }
    return n;
}

/** keep only the arrival times of the hit window, in place */
export function trimAdvertTimes(times: number[], now: number): void {
    while (times.length > 0 && now - times[0] > REC_HIT_WINDOW_MS) times.shift();
}

/**
 * Does a reconnect cycle have to start after a cold start? Yes if the setting is on, the last node is known and a
 * connection was up that the user did not disconnect (marker stored in the DB, '1').
 */
export function coldStartDue(enabled: boolean, lastDeviceId: string, wasConnected: string | null): boolean {
    return enabled && lastDeviceId !== "" && wasConnected === '1';
}

export interface ReconnectDeps {
    probeFn: (deviceId: string) => ReconnectProbe | null;
    connectFn: (deviceId: string) => Promise<boolean>;
}

export class AutoReconnectManager {
    private static instance: AutoReconnectManager;

    private deps: ReconnectDeps | null = null;
    private running = false;
    private cycleId = 0;
    private wakeSleep: (() => void) | null = null;
    private autoConnectedAt: number | null = null;
    private flaps: number[] = [];
    private expectedDisconnect = false;

    static getInstance() {
        if (!AutoReconnectManager.instance) {
            AutoReconnectManager.instance = new AutoReconnectManager();
        }
        return AutoReconnectManager.instance;
    }

    /** Connect.tsx registers its callbacks on mount */
    register(deps: ReconnectDeps) {
        this.deps = deps;
    }

    /** and removes them on unmount. A running cycle is stopped, it could not do anything without them */
    unregister() {
        this.deps = null;
        this.stop();
    }

    isRunning() {
        return this.running;
    }

    /**
     * The app itself makes the node drop the link (Deep Sleep, OTA mode). The next disconnect of a connected link is no loss:
     * no reconnect cycle. The flag stays until that disconnect or the next connect, because the disconnect may reach
     * the app much later (app in the background).
     */
    expectDisconnect() {
        LogS.log(0, "[RECONNECT] disconnect expected (node goes to sleep or OTA mode), no reconnect after it");
        this.expectedDisconnect = true;
    }

    /** returns true once if a disconnect was expected, and forgets it */
    takeExpectedDisconnect(): boolean {
        const expected = this.expectedDisconnect;
        this.expectedDisconnect = false;
        return expected;
    }

    /** a new connection is up: an old expectation does not apply any more */
    clearExpectedDisconnect() {
        this.expectedDisconnect = false;
    }

    /**
     * Start a cycle for a node we lost. Returns false if none was started.
     * `lastResult` tells the alert why, if there is something to tell.
     */
    start(deviceId: string): boolean {
        const st = ReconnectStore.getRawState();
        if (!st.enabled || deviceId === "") return false;
        if (this.running) return true;

        if (!this.deps) {
            LogS.log(1, "[RECONNECT] cycle requested but no callbacks registered (Connect tab not mounted?)");
            this.setResult('failed');
            return false;
        }

        // flap protection: the link we got back by reconnect dropped again right away, several times
        const now = Date.now();
        if (this.autoConnectedAt !== null && now - this.autoConnectedAt < REC_FLAP_WINDOW_MS) {
            this.flaps.push(now);
        }
        this.autoConnectedAt = null;
        this.flaps = this.flaps.filter((t) => now - t < REC_FLAP_HISTORY_MS);
        if (this.flaps.length >= REC_MAX_FLAPS) {
            LogS.log(1, "[RECONNECT] link keeps dropping (" + this.flaps.length + " flaps), no reconnect");
            this.flaps = [];
            this.setResult('flapping');
            return false;
        }

        this.running = true;
        const id = ++this.cycleId;
        ReconnectStore.update((s) => {
            s.state = 'searching';
            s.rssi = null;
            s.hits = null;
            s.attempt = 0;
            s.maxAttempts = REC_MAX_CONNECT_ATTEMPTS;
            s.lastResult = null;
        });
        LogS.log(0, "[RECONNECT] cycle " + id + " start, device: " + deviceId);

        this.run(id, deviceId).catch((e) => {
            LogS.log(1, "[RECONNECT] cycle " + id + " error: " + e);
            if (this.cycleId === id) this.finish(id, 'failed');
        });
        return true;
    }

    /** The user pressed cancel: the cycle ends and the normal disconnect alert shows */
    cancel() {
        if (!this.running) return;
        LogS.log(0, "[RECONNECT] cancelled by user");
        this.cycleId++;
        this.wake();
        this.running = false;
        this.setResult('cancelled');
    }

    /** End a cycle without any message (app goes to background, Connect tab unmounted) */
    stop() {
        if (!this.running) return;
        LogS.log(0, "[RECONNECT] stopped");
        this.cycleId++;
        this.wake();
        this.running = false;
        ReconnectStore.update((s) => {
            s.state = 'idle';
            s.rssi = null;
            s.hits = null;
            s.attempt = 0;
        });
    }

    /** The scan could not be started (Bluetooth off, permission): there is no point in searching */
    scanFailed() {
        if (!this.running) return;
        LogS.log(1, "[RECONNECT] scan failed, cycle ended");
        this.finish(this.cycleId, 'failed');
    }

    // ---- internals

    private setResult(result: ReconnectResult) {
        ReconnectStore.update((s) => {
            s.state = 'idle';
            s.attempt = 0;
            s.lastResult = result;
        });
    }

    private finish(id: number, result: ReconnectResult | null) {
        if (this.cycleId !== id) return;
        this.cycleId++;
        this.running = false;
        this.wake();
        if (result === null) {
            ReconnectStore.update((s) => {
                s.state = 'idle';
                s.rssi = null;
                s.hits = null;
                s.attempt = 0;
                s.lastResult = null;
            });
        } else {
            this.setResult(result);
        }
    }

    private wake() {
        if (this.wakeSleep) {
            const w = this.wakeSleep;
            this.wakeSleep = null;
            w();
        }
    }

    // sleep that ends early when the cycle is stopped
    private sleep(ms: number) {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                this.wakeSleep = null;
                resolve();
            }, ms);
            this.wakeSleep = () => {
                clearTimeout(timer);
                resolve();
            };
        });
    }

    private async run(id: number, deviceId: string) {
        // the time window starts with the cycle and starts again with the first connect attempt:
        // waiting for a better signal must not use up the time the connect attempts need
        let windowStart = Date.now();
        let attempts = 0;
        let everHeard = false;
        let lastWeak: 'rssi' | 'hits' | null = null;   // why the last heard probe was no reason to connect
        let lastRssi: number | null = null;
        let goodProbes = 0;
        let firstGoodAt: number | null = null;

        // log what the scan tells us, but only when it changes (a line per probe would flood the log)
        let lastPhase = "";
        const logPhase = (phase: string, text: string) => {
            if (phase === lastPhase) return;
            lastPhase = phase;
            LogS.log(0, "[RECONNECT] " + text);
        };

        while (this.cycleId === id) {
            if (Date.now() - windowStart >= REC_SEARCH_WINDOW_MS) {
                // nothing connected within the time window: tell the user why
                // the last reason counts: the RSSI flickers around the limit, a single good value must not
                // turn "signal too weak" into "heard too rarely" (poorLink)
                const reason: ReconnectResult = attempts > 0 ? 'failed'
                    : everHeard ? (lastWeak === 'rssi' ? 'weakSignal' : 'poorLink')
                    : 'notFound';
                LogS.log(0, "[RECONNECT] time window over, result: " + reason + ", last rssi: " + (lastRssi !== null ? lastRssi.toFixed(1) : "none"));
                this.finish(id, reason);
                return;
            }

            const deps = this.deps;
            if (!deps) {
                LogS.log(1, "[RECONNECT] callbacks gone, cycle ended");
                this.finish(id, 'failed');
                return;
            }

            const probe = deps.probeFn(deviceId);
            const fresh = probe !== null && probe.seenAgoMs <= REC_SEEN_MAX_AGE_MS;

            if (!fresh) {
                // node not heard (or not recently): keep searching, never connect
                logPhase("silent", probe === null
                    ? "node not heard yet"
                    : "node not heard for " + (probe.seenAgoMs / 1000).toFixed(1) + " s, last " + probe.rssi.toFixed(1) + " dBm");
                goodProbes = 0;
                firstGoodAt = null;
                ReconnectStore.update((s) => {
                    s.state = 'searching';
                    s.rssi = null;
                    s.hits = null;
                });
            } else {
                everHeard = true;
                lastRssi = probe!.rssi;

                // the link is judged by the strength AND by how many adverts arrive: a phone with a poor receiver
                // hears a node at -65 dBm only now and then, and then the connect request is lost as well
                const tooWeak = probe!.rssi < REC_MIN_RSSI;
                const tooFewHits = probe!.hits < REC_MIN_HITS;
                if (tooWeak) lastWeak = 'rssi';
                else if (tooFewHits) lastWeak = 'hits';

                if (tooWeak || tooFewHits) {
                    // heard, but the link would probably drop (or not even come up) while it is set up
                    logPhase(tooWeak ? "weak-rssi" : "weak-hits", tooWeak
                        ? "node heard at " + probe!.rssi.toFixed(1) + " dBm, below " + REC_MIN_RSSI + " dBm, no connect"
                        : "node heard at " + probe!.rssi.toFixed(1) + " dBm, but "
                            + (probe!.hits === 0 ? "no advert" : "only " + probe!.hits + " advert" + (probe!.hits === 1 ? "" : "s"))
                            + " in the last " + (REC_HIT_WINDOW_MS / 1000) + " s (" + REC_MIN_HITS + " needed), no connect");
                    goodProbes = 0;
                    firstGoodAt = null;
                    ReconnectStore.update((s) => {
                        s.state = 'weak';
                        s.rssi = probe!.rssi;
                        s.hits = probe!.hits;
                    });
                } else {
                    logPhase("ok", "node heard at " + probe!.rssi.toFixed(1) + " dBm, " + probe!.hits + " adverts in "
                        + (REC_HIT_WINDOW_MS / 1000) + " s, checking that the signal is stable");
                    goodProbes++;
                    if (firstGoodAt === null) firstGoodAt = Date.now();
                    ReconnectStore.update((s) => {
                        s.state = 'searching';
                        s.rssi = probe!.rssi;
                        s.hits = probe!.hits;
                    });

                    if (goodProbes >= REC_GOOD_PROBES && Date.now() - firstGoodAt >= REC_MIN_DWELL_MS) {
                        attempts++;
                        if (attempts === 1) windowStart = Date.now();
                        LogS.log(0, "[RECONNECT] node in range (" + probe!.rssi.toFixed(1) + " dBm), connect attempt " + attempts + "/" + REC_MAX_CONNECT_ATTEMPTS);
                        ReconnectStore.update((s) => {
                            s.state = 'connecting';
                            s.attempt = attempts;
                        });

                        let ok = false;
                        try {
                            ok = await deps.connectFn(deviceId);
                        } catch (e) {
                            LogS.log(1, "[RECONNECT] connect error: " + e);
                        }
                        if (this.cycleId !== id) return;  // cancelled meanwhile

                        if (ok) {
                            LogS.log(0, "[RECONNECT] reconnected");
                            this.autoConnectedAt = Date.now();
                            this.finish(id, null);
                            return;
                        }
                        if (attempts >= REC_MAX_CONNECT_ATTEMPTS) {
                            LogS.log(1, "[RECONNECT] no connection after " + attempts + " attempts");
                            this.finish(id, 'failed');
                            return;
                        }

                        // judge the signal again before the next try
                        goodProbes = 0;
                        firstGoodAt = null;
                        ReconnectStore.update((s) => {
                            s.state = 'searching';
                        });
                        await this.sleep(REC_BACKOFF_MS * attempts);
                        continue;
                    }
                }
            }

            await this.sleep(REC_POLL_MS);
        }
    }
}

export default AutoReconnectManager;
