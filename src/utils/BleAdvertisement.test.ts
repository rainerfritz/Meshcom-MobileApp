import { describe, expect, it } from "vitest";
import { advLocalName, meshcomManufacturerName } from "./BleAdvertisement";

// hex string -> DataView, like the plugin delivers rawAdvertisement
function view(hex: string): DataView {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return new DataView(bytes.buffer);
}

describe("advLocalName", () => {
  it("reads the complete local name of a MeshCom node advert (zero padded like the plugin delivers it)", () => {
    // flags + complete local name "MC-1c24-OE1KFR-1" + padding
    const raw = view("02010611094D432D316332342D4F45314B46522D31" + "00".repeat(21));
    expect(advLocalName(raw)).toBe("MC-1c24-OE1KFR-1");
  });

  it("returns null for an advert without a name", () => {
    // Apple manufacturer data only
    expect(advLocalName(view("07FF4C0012020001" + "00".repeat(20)))).toBeNull();
  });

  it("falls back to the shortened name", () => {
    expect(advLocalName(view("0408414243"))).toBe("ABC");
  });

  it("prefers the complete name over the shortened one", () => {
    expect(advLocalName(view("040841424305094142434400"))).toBe("ABCD");
  });

  it("does not read beyond a truncated structure", () => {
    // the name claims 17 bytes, but only 3 are there
    expect(advLocalName(view("020106" + "1109414243"))).toBeNull();
  });

  it("handles missing and empty data", () => {
    expect(advLocalName(undefined)).toBeNull();
    expect(advLocalName(null)).toBeNull();
    expect(advLocalName(new DataView(new ArrayBuffer(0)))).toBeNull();
  });
});

describe("meshcomManufacturerName", () => {
  // DataView of the text, like the plugin delivers the manufacturer data after the company id
  const text = (s: string): DataView => {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return new DataView(bytes.buffer);
  };

  it("reads the name of a node from the MeshCom manufacturer data", () => {
    expect(meshcomManufacturerName({ "17229": text("MC-1c24-OE1KFR-1") })).toBe("MC-1c24-OE1KFR-1");
  });

  it("finds the MeshCom entry also when it is not the first one", () => {
    expect(meshcomManufacturerName({ "76": text("xx"), "17229": text("MC-f25c-OE1KFR-7") })).toBe("MC-f25c-OE1KFR-7");
  });

  it("ignores other manufacturers and missing data", () => {
    expect(meshcomManufacturerName({ "76": text("12020001") })).toBeNull();
    expect(meshcomManufacturerName({})).toBeNull();
    expect(meshcomManufacturerName(undefined)).toBeNull();
    expect(meshcomManufacturerName(null)).toBeNull();
  });

  it("drops the zero padding and returns null for an empty payload", () => {
    expect(meshcomManufacturerName({ "17229": text("MC-1c24-OE1KFR-1\0\0") })).toBe("MC-1c24-OE1KFR-1");
    expect(meshcomManufacturerName({ "17229": new DataView(new ArrayBuffer(0)) })).toBeNull();
    expect(meshcomManufacturerName({ "17229": text("\0\0") })).toBeNull();
  });

  it("reads only the part of a larger buffer that belongs to the view", () => {
    const buf = new Uint8Array([0x58, 0x58, 0x4d, 0x43, 0x2d, 0x31, 0x58]).buffer;   // "XXMC-1X"
    expect(meshcomManufacturerName({ "17229": new DataView(buf, 2, 4) })).toBe("MC-1");
  });
});
