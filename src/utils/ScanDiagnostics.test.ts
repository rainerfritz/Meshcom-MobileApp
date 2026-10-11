import { describe, expect, it } from "vitest";
import ScanDiagnostics from "./ScanDiagnostics";

const STALE = 10000;
const ID = "3C:61:05:34:1C:26";

describe("ScanDiagnostics", () => {
  it("reports the adverts, the gap and the rssi of a node in the window", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    d.nodeResult(ID, "OE1KFR-1", 1000, -60, true);
    d.nodeResult(ID, "OE1KFR-1", 2000, -83, true);
    d.nodeResult(ID, "OE1KFR-1", 6000, -64, false);

    const lines = d.report(10000, STALE);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("OE1KFR-1: 3 adverts in 10 s (1 without name)");
    expect(lines[0]).toContain("max gap 4.0 s");
    expect(lines[0]).toContain("rssi -83..-60");
    expect(lines[0]).toContain("last heard 4.0 s ago, in the list");
  });

  it("starts a new window after a report but keeps when the node was heard last", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    d.nodeResult(ID, "OE1KFR-1", 5000, -60, true);
    d.report(10000, STALE);

    const lines = d.report(20000, STALE);
    expect(lines[0]).toContain("0 adverts in 10 s");
    expect(lines[0]).toContain("last heard 15.0 s ago, NOT in the list");
  });

  it("counts the first advert from the scan start", () => {
    const d = new ScanDiagnostics();
    d.start(1000);
    d.nodeResult(ID, "OE1KFR-1", 9000, -70, true);
    expect(d.report(10000, STALE)[0]).toContain("max gap 8.0 s");
  });

  it("reports a watched node that was never heard", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    const lines = d.report(10000, STALE, [{ id: ID, label: "OE1KFR-1" }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("OE1KFR-1: 0 adverts in 10 s, not heard since the scan started, NOT in the list");
  });

  it("shows the results of all devices, so a dead scan can be told from a silent node", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    for (let i = 0; i < 250; i++) d.anyResult();
    const lines = d.report(10000, STALE, [{ id: ID, label: "OE1KFR-1" }]);
    expect(lines[0]).toContain("250 results of all devices");
    // the counter starts again with the next window
    expect(d.report(20000, STALE, [{ id: ID, label: "OE1KFR-1" }])[0]).toContain("0 results of all devices");
  });

  it("a restart of the scan clears everything, the pause is no gap", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    d.nodeResult(ID, "OE1KFR-1", 1000, -60, true);
    d.start(30000);
    d.nodeResult(ID, "OE1KFR-1", 31000, -60, true);
    expect(d.report(40000, STALE)[0]).toContain("max gap 1.0 s");
  });

  it("gives no lines when no node was heard and none is watched", () => {
    const d = new ScanDiagnostics();
    d.start(0);
    expect(d.report(10000, STALE)).toEqual([]);
  });
});
