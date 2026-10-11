import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutoReconnectManager,
  REC_BACKOFF_MS,
  REC_HIT_WINDOW_MS,
  advertHits,
  trimAdvertTimes,
  REC_FLAP_WINDOW_MS,
  REC_MAX_CONNECT_ATTEMPTS,
  REC_MIN_HITS,
  REC_MIN_RSSI,
  REC_SEARCH_WINDOW_MS,
  REC_SEEN_MAX_AGE_MS,
  ReconnectProbe,
} from "./AutoReconnectManager";
import ReconnectStore, { defaultReconnectState } from "../store/ReconnectStore";

const DEV = "AA:BB:CC:DD:EE:FF";

// a probe that returns whatever the test sets
function setup(probe: () => ReconnectProbe | null, connect: () => Promise<boolean> = async () => true) {
  const mgr = new AutoReconnectManager();
  const probeFn = vi.fn((_id: string) => probe());
  const connectFn = vi.fn(async (_id: string) => connect());
  mgr.register({ probeFn, connectFn });
  return { mgr, probeFn, connectFn };
}

const heard = (rssi: number, hits: number = REC_MIN_HITS + 2): ReconnectProbe => ({ seenAgoMs: 200, rssi, hits });
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const st = () => ReconnectStore.getRawState();

beforeEach(() => {
  vi.useFakeTimers();
  ReconnectStore.update((s) => {
    Object.assign(s, defaultReconnectState, { enabled: true, lastDeviceId: DEV });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AutoReconnectManager", () => {
  it("does not start when the setting is off", () => {
    ReconnectStore.update((s) => { s.enabled = false; });
    const { mgr, probeFn } = setup(() => heard(-60));
    expect(mgr.start(DEV)).toBe(false);
    expect(probeFn).not.toHaveBeenCalled();
    expect(st().state).toBe('idle');
  });

  it("never connects while the node is not heard and ends with notFound", async () => {
    const { mgr, connectFn } = setup(() => null);
    expect(mgr.start(DEV)).toBe(true);
    expect(st().state).toBe('searching');

    await advance(REC_SEARCH_WINDOW_MS + 2000);

    expect(connectFn).not.toHaveBeenCalled();
    expect(st().state).toBe('idle');
    expect(st().lastResult).toBe('notFound');
    expect(mgr.isRunning()).toBe(false);
  });

  it("counts a stale scan hit as not heard", async () => {
    const { mgr, connectFn } = setup(() => ({ seenAgoMs: REC_SEEN_MAX_AGE_MS + 5000, rssi: -50, hits: 10 }));
    mgr.start(DEV);
    await advance(REC_SEARCH_WINDOW_MS + 2000);
    expect(connectFn).not.toHaveBeenCalled();
    expect(st().lastResult).toBe('notFound');
  });

  it("does not connect below the minimum RSSI and ends with weakSignal", async () => {
    const { mgr, connectFn } = setup(() => heard(REC_MIN_RSSI - 3));
    mgr.start(DEV);

    await advance(5000);
    expect(st().state).toBe('weak');
    expect(st().rssi).toBe(REC_MIN_RSSI - 3);

    await advance(REC_SEARCH_WINDOW_MS);
    expect(connectFn).not.toHaveBeenCalled();
    expect(st().lastResult).toBe('weakSignal');
    expect(st().state).toBe('idle');
  });

  it("does not connect while the node is heard too rarely, although the RSSI is fine", async () => {
    const { mgr, connectFn } = setup(() => heard(-62, REC_MIN_HITS - 1));
    mgr.start(DEV);

    await advance(8000);
    expect(st().state).toBe('weak');
    expect(st().rssi).toBe(-62);
    expect(st().hits).toBe(REC_MIN_HITS - 1);

    await advance(REC_SEARCH_WINDOW_MS);
    expect(connectFn).not.toHaveBeenCalled();
    expect(st().lastResult).toBe('poorLink');
  });

  it("ends with weakSignal when the RSSI flickers around the limit but is mostly below it", async () => {
    // one value at the limit must not turn "signal too weak" into "heard too rarely"
    let rssi = REC_MIN_RSSI;
    const { mgr, connectFn } = setup(() => heard(rssi));
    mgr.start(DEV);
    await advance(1500);   // too short for a connect (dwell time), the value is fine

    rssi = REC_MIN_RSSI - 2;
    await advance(REC_SEARCH_WINDOW_MS);

    expect(connectFn).not.toHaveBeenCalled();
    expect(st().lastResult).toBe('weakSignal');
  });

  it("ends with poorLink when the signal was weak first and the node is then heard too rarely", async () => {
    let probe = heard(REC_MIN_RSSI - 3);
    const { mgr, connectFn } = setup(() => probe);
    mgr.start(DEV);
    await advance(3000);

    probe = heard(-62, REC_MIN_HITS - 1);
    await advance(REC_SEARCH_WINDOW_MS);

    expect(connectFn).not.toHaveBeenCalled();
    expect(st().lastResult).toBe('poorLink');
  });

  it("connects when the hit rate gets good enough", async () => {
    let hits = 1;
    const { mgr, connectFn } = setup(() => heard(-62, hits));
    mgr.start(DEV);

    await advance(8000);
    expect(connectFn).not.toHaveBeenCalled();

    hits = REC_MIN_HITS;
    await advance(8000);
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(st().lastResult).toBeNull();
  });

  it("connects when the signal gets good enough", async () => {
    let rssi = -95;
    const { mgr, connectFn } = setup(() => heard(rssi));
    mgr.start(DEV);

    await advance(10000);
    expect(connectFn).not.toHaveBeenCalled();
    expect(st().state).toBe('weak');

    rssi = -85;
    await advance(8000);
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(connectFn).toHaveBeenCalledWith(DEV);
    expect(st().state).toBe('idle');
    expect(st().lastResult).toBeNull();
    expect(mgr.isRunning()).toBe(false);
  });

  it("does not connect when the RSSI flips around the threshold", async () => {
    let n = 0;
    const { mgr, connectFn } = setup(() => heard(n++ % 2 === 0 ? REC_MIN_RSSI + 1 : REC_MIN_RSSI - 1));
    mgr.start(DEV);
    await advance(30000);
    expect(connectFn).not.toHaveBeenCalled();
  });

  it("gives up after the maximum connect attempts", async () => {
    const { mgr, connectFn } = setup(() => heard(-70), async () => false);
    mgr.start(DEV);
    await advance(REC_SEARCH_WINDOW_MS);

    expect(connectFn).toHaveBeenCalledTimes(REC_MAX_CONNECT_ATTEMPTS);
    expect(st().lastResult).toBe('failed');
    expect(st().state).toBe('idle');
  });

  it("does not count the wait for a better signal against the connect attempts", async () => {
    let rssi = -95;
    const { mgr, connectFn } = setup(() => heard(rssi), async () => false);
    mgr.start(DEV);

    // 50 s too weak: with one window from the start only 2 attempts would fit into the 60 s
    await advance(50000);
    expect(connectFn).not.toHaveBeenCalled();

    rssi = -70;
    await advance(40000);

    expect(connectFn).toHaveBeenCalledTimes(REC_MAX_CONNECT_ATTEMPTS);
    expect(st().lastResult).toBe('failed');
    expect(mgr.isRunning()).toBe(false);
  });

  it("waits and judges the signal again after a failed connect", async () => {
    let calls = 0;
    const { mgr, connectFn } = setup(() => heard(-70), async () => ++calls >= 2);
    mgr.start(DEV);

    await advance(3500);
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(st().state).toBe('searching');

    // not before the backoff has passed
    await advance(REC_BACKOFF_MS - 500);
    expect(connectFn).toHaveBeenCalledTimes(1);

    await advance(8000);
    expect(connectFn).toHaveBeenCalledTimes(2);
    expect(st().lastResult).toBeNull();
    expect(st().state).toBe('idle');
  });

  it("cancel ends the cycle with cancelled and stops probing", async () => {
    const { mgr, probeFn } = setup(() => null);
    mgr.start(DEV);
    await advance(3000);

    mgr.cancel();
    expect(st().state).toBe('idle');
    expect(st().lastResult).toBe('cancelled');

    const calls = probeFn.mock.calls.length;
    await advance(10000);
    expect(probeFn.mock.calls.length).toBe(calls);
    expect(mgr.isRunning()).toBe(false);
  });

  it("stop ends the cycle without a result", async () => {
    const { mgr } = setup(() => null);
    mgr.start(DEV);
    await advance(2000);
    mgr.stop();
    expect(st().state).toBe('idle');
    expect(st().lastResult).toBeNull();
  });

  it("does not start a second cycle", async () => {
    const { mgr, probeFn } = setup(() => null);
    expect(mgr.start(DEV)).toBe(true);
    expect(mgr.start(DEV)).toBe(true);
    await advance(1);
    // only one loop probes
    expect(probeFn).toHaveBeenCalledTimes(1);
  });

  it("fails without registered callbacks", () => {
    const mgr = new AutoReconnectManager();
    expect(mgr.start(DEV)).toBe(false);
    expect(st().lastResult).toBe('failed');
  });

  it("a scan failure ends the cycle", async () => {
    const { mgr, connectFn } = setup(() => null);
    mgr.start(DEV);
    await advance(1000);
    mgr.scanFailed();
    expect(st().lastResult).toBe('failed');
    await advance(5000);
    expect(connectFn).not.toHaveBeenCalled();
  });

  it("unregister stops a running cycle", async () => {
    const { mgr } = setup(() => null);
    mgr.start(DEV);
    await advance(1000);
    mgr.unregister();
    expect(mgr.isRunning()).toBe(false);
    expect(st().state).toBe('idle');
  });

  it("stops after the link dropped again right after each reconnect (flapping)", async () => {
    const { mgr, connectFn } = setup(() => heard(-70));

    // each cycle reconnects, the link drops again within the flap window and a new cycle is requested
    for (let i = 0; i < 3; i++) {
      expect(mgr.start(DEV)).toBe(true);
      await advance(5000);
      expect(mgr.isRunning()).toBe(false);
    }
    expect(connectFn).toHaveBeenCalledTimes(3);

    // the third drop within the window: no more reconnect, the alert says why
    expect(mgr.start(DEV)).toBe(false);
    expect(st().lastResult).toBe('flapping');
    expect(st().state).toBe('idle');
  });

  it("does not count a drop long after the reconnect as a flap", async () => {
    const { mgr } = setup(() => heard(-70));
    for (let i = 0; i < 4; i++) {
      expect(mgr.start(DEV)).toBe(true);
      await advance(5000);
      // the link held for longer than the flap window
      await advance(REC_FLAP_WINDOW_MS + 1000);
    }
    expect(st().lastResult).toBeNull();
  });
});

describe("advert hit rate", () => {
  it("counts only the adverts inside the window that ends now", () => {
    const now = 100000;
    const times = [now - REC_HIT_WINDOW_MS - 1, now - REC_HIT_WINDOW_MS, now - 3000, now - 100, now];
    expect(advertHits(times, now)).toBe(4);
  });

  it("trim keeps the same adverts that count as hits", () => {
    const now = 100000;
    const w = REC_HIT_WINDOW_MS;
    const times = [now - w - 4000, now - w - 1, now - w + 2000, now - 1000];
    trimAdvertTimes(times, now);
    expect(times).toEqual([now - w + 2000, now - 1000]);
    expect(advertHits(times, now)).toBe(2);
  });

  it("an advert that is older than the window does not count any more", () => {
    const times = [1000];
    expect(advertHits(times, 1000 + REC_HIT_WINDOW_MS)).toBe(1);
    expect(advertHits(times, 1000 + REC_HIT_WINDOW_MS + 1)).toBe(0);
  });
});

describe("expected disconnect (node sent to sleep)", () => {
  it("is reported once and then forgotten", () => {
    const mgr = new AutoReconnectManager();
    expect(mgr.takeExpectedDisconnect()).toBe(false);

    mgr.expectDisconnect();
    expect(mgr.takeExpectedDisconnect()).toBe(true);
    expect(mgr.takeExpectedDisconnect()).toBe(false);
  });

  it("is dropped when a new connection comes up", () => {
    const mgr = new AutoReconnectManager();
    mgr.expectDisconnect();
    mgr.clearExpectedDisconnect();
    expect(mgr.takeExpectedDisconnect()).toBe(false);
  });
});

