import { describe, expect, it } from "vitest";
import { isForeignDm } from "./MsgFilter";

describe("isForeignDm", () => {
  it("drops a DM between third parties relayed by a gateway (DK5EN-98 > OE1KFR-3 at OE1KFR-7)", () => {
    expect(isForeignDm("DK5EN-98", "OE1KFR-3", "OE1KFR-7", 1, 0)).toBe(true);
  });

  it("keeps a DM addressed to us", () => {
    expect(isForeignDm("DK5EN-98", "OE1KFR-7", "OE1KFR-7", 1, 0)).toBe(false);
  });

  it("keeps our own sent DM", () => {
    expect(isForeignDm("OE1KFR-7", "DK5EN-98", "OE1KFR-7", 1, 0)).toBe(false);
  });

  it("does not touch group and broadcast messages", () => {
    expect(isForeignDm("DK5EN-98", "9", "OE1KFR-7", 1, 1)).toBe(false);
    expect(isForeignDm("DK5EN-98", "", "OE1KFR-7", 0, 0)).toBe(false);
  });

  it("does not filter while the own callsign is unknown or unset", () => {
    expect(isForeignDm("DK5EN-98", "OE1KFR-3", "", 1, 0)).toBe(false);
    expect(isForeignDm("DK5EN-98", "OE1KFR-3", "XX0XXX-00", 1, 0)).toBe(false);
  });

  it("ignores case and surrounding whitespace but distinguishes the SSID", () => {
    expect(isForeignDm("DK5EN-98", " oe1kfr-7 ", "OE1KFR-7", 1, 0)).toBe(false);
    expect(isForeignDm("DK5EN-98", "OE1KFR-12", "OE1KFR-7", 1, 0)).toBe(true);
    expect(isForeignDm("DK5EN-98", "OE1KFR", "OE1KFR-7", 1, 0)).toBe(true);
  });
});
