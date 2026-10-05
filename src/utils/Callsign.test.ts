import { describe, expect, it } from "vitest";
import { normalizeCallsignSsid, bleNodeCallsign, compareBleNodes } from "./Callsign";

describe("normalizeCallsignSsid", () => {
  it("strips the leading zero of a two-digit SSID", () => {
    expect(normalizeCallsignSsid("OE1KFR-02")).toBe("OE1KFR-2");
    expect(normalizeCallsignSsid("OE1KFR-09")).toBe("OE1KFR-9");
    expect(normalizeCallsignSsid("OE1KFR-00")).toBe("OE1KFR-0");
    expect(normalizeCallsignSsid("S54R-01")).toBe("S54R-1");
    expect(normalizeCallsignSsid("9A2EAB-04")).toBe("9A2EAB-4");
  });

  it("keeps SSIDs without a leading zero", () => {
    expect(normalizeCallsignSsid("OE1KFR-1")).toBe("OE1KFR-1");
    expect(normalizeCallsignSsid("OE1KFR-10")).toBe("OE1KFR-10");
    expect(normalizeCallsignSsid("OE1KFR-12")).toBe("OE1KFR-12");
  });

  it("does not touch zeros in the callsign itself", () => {
    expect(normalizeCallsignSsid("OE0ABC-1")).toBe("OE0ABC-1");
    expect(normalizeCallsignSsid("OE1KFR")).toBe("OE1KFR");
  });
});

describe("bleNodeCallsign", () => {
  it("returns the callsign of a MeshCom BLE name", () => {
    expect(bleNodeCallsign("MC-1c24-OE1KFR-1")).toBe("OE1KFR-1");
    expect(bleNodeCallsign("MC-A0F3-OE3ABC-12")).toBe("OE3ABC-12");
  });

  it("keeps names without the MC prefix", () => {
    expect(bleNodeCallsign("OE1KFR-1")).toBe("OE1KFR-1");
    expect(bleNodeCallsign("Some Headset")).toBe("Some Headset");
  });
});

describe("compareBleNodes", () => {
  const sorted = (names: string[]) => [...names].sort(compareBleNodes);

  it("sorts by callsign and ignores the node id in the name", () => {
    expect(sorted(["MC-ffff-OE3ABC-1", "MC-0001-OE5LNG-9", "MC-1c24-OE1KFR-1"]))
      .toEqual(["MC-1c24-OE1KFR-1", "MC-ffff-OE3ABC-1", "MC-0001-OE5LNG-9"]);
  });

  it("sorts the SSID numerically", () => {
    expect(sorted(["MC-1111-OE1KFR-10", "MC-2222-OE1KFR-2", "MC-3333-OE1KFR-1"]))
      .toEqual(["MC-3333-OE1KFR-1", "MC-2222-OE1KFR-2", "MC-1111-OE1KFR-10"]);
  });

  it("puts a callsign without SSID before the same callsign with SSID", () => {
    expect(sorted(["MC-2222-OE1KFR-1", "MC-1111-OE1KFR"])).toEqual(["MC-1111-OE1KFR", "MC-2222-OE1KFR-1"]);
  });

  it("falls back to the full name for the same callsign", () => {
    expect(sorted(["MC-b000-OE1KFR-1", "MC-a000-OE1KFR-1"])).toEqual(["MC-a000-OE1KFR-1", "MC-b000-OE1KFR-1"]);
  });
});
