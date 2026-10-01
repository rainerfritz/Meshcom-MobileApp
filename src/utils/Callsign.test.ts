import { describe, expect, it } from "vitest";
import { normalizeCallsignSsid } from "./Callsign";

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
