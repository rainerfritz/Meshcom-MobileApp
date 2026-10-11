import { describe, expect, it } from "vitest";
import { reconnectResultText, reconnectStatusText } from "./ReconnectText";
import { REC_HIT_WINDOW_MS, REC_MIN_HITS, REC_MIN_RSSI } from "./AutoReconnectManager";

const base = { attempt: 0, maxAttempts: 3 };

describe("reconnectStatusText", () => {
  it("tells that the signal is too weak when the RSSI is below the minimum", () => {
    const t = reconnectStatusText({ ...base, state: 'weak', rssi: REC_MIN_RSSI - 3, hits: 10 });
    expect(t).toContain("Signal too weak");
    expect(t).toContain("-93.0 dBm");
  });

  it("tells that the node is heard too rarely when the RSSI is fine", () => {
    const t = reconnectStatusText({ ...base, state: 'weak', rssi: -62, hits: 1 });
    expect(t).toContain("Link quality too low");
    expect(t).not.toContain("Signal too weak");
    expect(t).toContain("heard only 1 time in " + REC_HIT_WINDOW_MS / 1000 + " s");
    expect(t).toContain(REC_MIN_HITS + " needed");
  });

  it("uses the plural for several hits", () => {
    const t = reconnectStatusText({ ...base, state: 'weak', rssi: -62, hits: 2 });
    expect(t).toContain("heard only 2 times");
  });

  it("says that the node was not heard at all when there is no hit", () => {
    const t = reconnectStatusText({ ...base, state: 'weak', rssi: -62, hits: 0 });
    expect(t).toContain("not heard in the last " + REC_HIT_WINDOW_MS / 1000 + " s");
  });

  it("gives the end results their own wording", () => {
    expect(reconnectResultText('weakSignal', -93)).toContain("Signal too weak (-93.0 dBm)");
    expect(reconnectResultText('poorLink', -63)).toContain("Link quality too low (-63.0 dBm)");
    expect(reconnectResultText('poorLink', -63)).not.toContain("Signal too weak");
    expect(reconnectResultText('failed', null)).toContain("link quality");
    expect(reconnectResultText(null, null)).toBeNull();
  });

  it("shows the search and connect texts as before", () => {
    expect(reconnectStatusText({ ...base, state: 'searching', rssi: null, hits: null })).toContain("not in range yet");
    expect(reconnectStatusText({ ...base, state: 'connecting', rssi: -60, hits: 5, attempt: 2 })).toContain("attempt 2/3");
  });
});
