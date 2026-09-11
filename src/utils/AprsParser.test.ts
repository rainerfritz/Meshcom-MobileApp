import { describe, expect, it } from "vitest";
import {
  parsePositionPayload,
  readFrameTrailer,
  readMsgId,
  readNodeTimestampMs,
  decodeFlags,
} from "./AprsParser";

// Fixtures are real payloads from the firmware corpus / app comments, per
// docs/architecture/11-wire-format.md §1.8 and docs/aprs-parser-drift-20260911.md.

describe("parsePositionPayload", () => {
  it("parses a minimal beacon: symbol, battery, altitude", () => {
    const p = parsePositionPayload("4814.23N/01618.97Eu/B=100/A=000787");
    expect(p).not.toBeNull();
    expect(p!.symbolTable).toBe("/");
    expect(p!.symbol).toBe("u");
    expect(p!.bat).toBe(100);
    expect(p!.alt).toBe(240); // 787 ft * 0.3048 -> 239.9736 -> 240
    expect(p!.comment).toBe("");
    expect(p!.lat).toBeCloseTo(48.2372, 4);
    expect(p!.lon).toBeCloseTo(16.3162, 4);
  });

  it("parses a full sensor block (P/H/T/Q)", () => {
    const p = parsePositionPayload(
      "0122.64N/10356.52E#/B=005/A=000161/P=1004.9/H=40.2/T=28.9/Q=1005.4"
    );
    expect(p).not.toBeNull();
    expect(p!.symbolTable).toBe("/");
    expect(p!.symbol).toBe("#");
    expect(p!.bat).toBe(5);
    expect(p!.alt).toBe(49); // 161 ft -> 49.0728 -> 49
    expect(p!.pressure).toBe(1004.9);
    expect(p!.humidity).toBe(40.2);
    expect(p!.temperature).toBe(28.9);
    expect(p!.qnh).toBe(1005.4);
    expect(p!.lat).toBeCloseTo(1.3773, 4);
    expect(p!.lon).toBeCloseTo(103.942, 4);
  });

  it("parses temp2, pressure altitude and data version", () => {
    const p = parsePositionPayload(
      "4814.35N/01619.05E#/A=000804/P=984.3/H=48.0/T=20.7/O=20.8/F=243/G=36.3/V=3"
    );
    expect(p).not.toBeNull();
    expect(p!.temp2).toBe(20.8);
    expect(p!.altPress).toBe(243); // /F= is metres, not a pressure
    expect(p!.dataVersion).toBe(3);
    expect(p!.pressure).toBe(984.3);
    expect(p!.humidity).toBe(48.0);
    expect(p!.temperature).toBe(20.7);
    expect(p!.gasRes).toBe(36.3);
    expect(p!.alt).toBe(245); // 804 ft -> 245.0592 -> 245
  });

  it("keeps a free-text comment before the tail, untrimmed", () => {
    const p = parsePositionPayload("4711.55N/01444.60E_MeshCom Zeltweg /B=089/A=002451");
    expect(p).not.toBeNull();
    expect(p!.symbol).toBe("_");
    // Deliberately not trimmed: the comment is exactly the slice up to the
    // first `/X=` token, matching what the firmware encoder concatenated.
    expect(p!.comment).toBe("MeshCom Zeltweg ");
    expect(p!.name).toBe(""); // no `#` in the region -> no name, comment unaffected
    expect(p!.bat).toBe(89);
    expect(p!.alt).toBe(747); // 2451 ft -> 747.2 -> 747
  });

  it("splits a node name appended after the comment with '#'", () => {
    const p = parsePositionPayload("4812.34N/01143.56E_Hello World#DK5EN-1/B=050");
    expect(p).not.toBeNull();
    expect(p!.comment).toBe("Hello World");
    expect(p!.name).toBe("DK5EN-1");
    expect(p!.bat).toBe(50);
  });

  it("splits on the LAST '#' when the free-text comment itself contains one", () => {
    const p = parsePositionPayload("4812.34N/01143.56E_Channel #3#DK5EN-2/B=060");
    expect(p).not.toBeNull();
    expect(p!.comment).toBe("Channel #3");
    expect(p!.name).toBe("DK5EN-2");
    expect(p!.bat).toBe(60);
  });

  it("parses a name with no free-text comment before it", () => {
    const p = parsePositionPayload("4812.34N/01143.56E_#DK5EN-3/B=070");
    expect(p).not.toBeNull();
    expect(p!.comment).toBe("");
    expect(p!.name).toBe("DK5EN-3");
    expect(p!.bat).toBe(70);
  });

  it("splits comment and name from a beacon with battery/altitude, per the agreed contract", () => {
    const p = parsePositionPayload("4812.34N/01143.56E_Foo#Bar/B=085/A=001526");
    expect(p).not.toBeNull();
    expect(p!.comment).toBe("Foo");
    expect(p!.name).toBe("Bar");
    expect(p!.bat).toBe(85);
  });

  it("uses backslash table char, last-wins on a repeated key, comment stops at the first token", () => {
    const p = parsePositionPayload(
      "4825.35N\\01147.19E-Standort/H=520m Dach/T=22.6/H=42.5/P=940.3"
    );
    expect(p).not.toBeNull();
    expect(p!.symbolTable).toBe("\\");
    expect(p!.symbol).toBe("-");
    expect(p!.comment).toContain("Standort");
    expect(p!.humidity).toBe(42.5); // last /H= occurrence wins over the fake one in the comment tail
    expect(p!.temperature).toBe(22.6);
    expect(p!.pressure).toBe(940.3);
  });

  it("parses every one of the 17 keys from one beacon", () => {
    const p = parsePositionPayload(
      "4812.34N/01143.56E#/B=085/A=001526/N12/P=940.3/H=42.1/T=22.6/O=17.8/F=453/Q=956.9/G=236.8/C=412/R=9;20;/V=3/U=12.34/I=0.5/D=00000101/Y=1"
    );
    expect(p).not.toBeNull();
    expect(p!.bat).toBe(85);
    expect(p!.alt).toBe(465); // 1526 ft -> 465.1248 -> 465
    expect(p!.neighbourCount).toBe(12);
    expect(p!.pressure).toBe(940.3);
    expect(p!.humidity).toBe(42.1);
    expect(p!.temperature).toBe(22.6);
    expect(p!.temp2).toBe(17.8);
    expect(p!.altPress).toBe(453);
    expect(p!.qnh).toBe(956.9);
    expect(p!.gasRes).toBe(236.8);
    expect(p!.co2).toBe(412);
    expect(p!.groups).toEqual([9, 20]);
    expect(p!.dataVersion).toBe(3);
    expect(p!.vbus).toBe(12.34);
    expect(p!.vcurrent).toBe(0.5);
    expect(p!.din).toBe("00000101");
    expect(p!.telemetryFlag).toBe(true);
  });

  it("regression: a comment starting with N+digit is not mistaken for neighbourCount", () => {
    const p = parsePositionPayload("4812.34N/01143.56E#N3 Dach/N7");
    expect(p).not.toBeNull();
    expect(p!.comment).toBe("N3 Dach");
    expect(p!.neighbourCount).toBe(7);
  });

  it("rejects a 7-character /D= value (must be exactly 8 binary chars)", () => {
    const p = parsePositionPayload("4812.34N/01143.56E#/D=0000010");
    expect(p).not.toBeNull();
    expect(p!.din).toBeUndefined();
  });

  it("clamps/ignores a /B= value over 100", () => {
    const p = parsePositionPayload("4812.34N/01143.56E#/B=150");
    expect(p).not.toBeNull();
    expect(p!.bat).toBeUndefined();
  });

  it("handles a negative lat/lon (S/W hemisphere)", () => {
    const p = parsePositionPayload("3345.60S/07012.30W>");
    expect(p).not.toBeNull();
    expect(p!.symbol).toBe(">");
    expect(p!.lat).toBeCloseTo(-33.76, 4);
    expect(p!.lon).toBeCloseTo(-70.205, 4);
    expect(p!.lat).toBeLessThan(0);
    expect(p!.lon).toBeLessThan(0);
  });

  it("returns null for garbage input", () => {
    expect(parsePositionPayload("garbage")).toBeNull();
    expect(parsePositionPayload("")).toBeNull();
  });
});

describe("readMsgId", () => {
  it("reads a little-endian uint32", () => {
    const bytes = new Uint8Array([0x57, 0xe0, 0xe1, 0x1a]);
    const dv = new DataView(bytes.buffer);
    expect(readMsgId(dv, 0)).toBe(0x1ae1e057);
  });

  it("reads at a non-zero offset", () => {
    const bytes = new Uint8Array([0xff, 0xff, 0x57, 0xe0, 0xe1, 0x1a]);
    const dv = new DataView(bytes.buffer);
    expect(readMsgId(dv, 2)).toBe(0x1ae1e057);
  });
});

describe("decodeFlags", () => {
  it("decodes maxHop and server from 0x85", () => {
    const f = decodeFlags(0x85);
    expect(f.maxHop).toBe(5);
    expect(f.server).toBe(true);
    expect(f.mesh).toBe(false);
    expect(f.appOffline).toBe(false);
    expect(f.track).toBe(false);
  });

  it("decodes mesh, track and appOffline bits", () => {
    const f = decodeFlags(0x70); // mesh | track | app_offline, hop 0
    expect(f.maxHop).toBe(0);
    expect(f.mesh).toBe(true);
    expect(f.track).toBe(true);
    expect(f.appOffline).toBe(true);
    expect(f.server).toBe(false);
  });
});

describe("readNodeTimestampMs", () => {
  it("reads the 4-byte BE timestamp ending 5 bytes before the buffer end", () => {
    // 0x6AA2BF09 = 1789050633 seconds since epoch; trailing 0x00 is the pad byte.
    const bytes = new Uint8Array([0x01, 0x02, 0x6a, 0xa2, 0xbf, 0x09, 0x00]);
    const dv = new DataView(bytes.buffer);
    expect(readNodeTimestampMs(dv)).toBe(1789050633000);
  });

  it("returns null for a timestamp before 2024-01-01", () => {
    // 0x00000000 seconds -> epoch 1970, well before the floor.
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]);
    const dv = new DataView(bytes.buffer);
    expect(readNodeTimestampMs(dv)).toBeNull();
  });

  it("returns null for a timestamp more than 24h in the future", () => {
    const farFutureSeconds = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60;
    const bytes = new Uint8Array(5);
    const dv = new DataView(bytes.buffer);
    dv.setUint32(0, farFutureSeconds, false);
    expect(readNodeTimestampMs(dv)).toBeNull();
  });
});

describe("readFrameTrailer", () => {
  it("reads hwId, mod, fcs and the optional FW/LASTHW/FWSUB group", () => {
    const bytes = new Uint8Array([0x00, 0x09, 0x03, 0x0c, 0x40, 0x23, 0x89, 0x70, 0x7e]);
    const dv = new DataView(bytes.buffer);
    const trailer = readFrameTrailer(dv, 0);
    expect(trailer).not.toBeNull();
    expect(trailer!.hwId).toBe(9);
    expect(trailer!.mod).toBe(3);
    expect(trailer!.fcs).toBe(0x0c40);
    expect(trailer!.fw).toBe(35);
    expect(trailer!.lastHw).toBe(0x89);
    expect(trailer!.fwSub).toBe("p");
  });

  it("tolerates a missing optional trailer group", () => {
    const bytes = new Uint8Array([0x00, 0x09, 0x03, 0x0c, 0x40]);
    const dv = new DataView(bytes.buffer);
    const trailer = readFrameTrailer(dv, 0);
    expect(trailer).not.toBeNull();
    expect(trailer!.hwId).toBe(9);
    expect(trailer!.mod).toBe(3);
    expect(trailer!.fcs).toBe(0x0c40);
    expect(trailer!.fw).toBeUndefined();
    expect(trailer!.lastHw).toBeUndefined();
    expect(trailer!.fwSub).toBeUndefined();
  });

  it("maps a 0x00 or 0x7E FW-sub byte back to '#'", () => {
    const bytes = new Uint8Array([0x00, 0x09, 0x03, 0x0c, 0x40, 0x23, 0x89, 0x00, 0x7e]);
    const dv = new DataView(bytes.buffer);
    const trailer = readFrameTrailer(dv, 0);
    expect(trailer!.fwSub).toBe("#");
  });

  it("returns null when even the base fields are truncated", () => {
    const bytes = new Uint8Array([0x00, 0x09, 0x03]);
    const dv = new DataView(bytes.buffer);
    expect(readFrameTrailer(dv, 0)).toBeNull();
  });

  it("locates the trailer at a non-zero zeroIndex within a larger buffer", () => {
    const bytes = new Uint8Array([
      0x3a, 0x01, 0x02, 0x03, 0x04, 0x91, 0x00, 0x09, 0x03, 0x0c, 0x40, 0x23, 0x89, 0x70, 0x7e,
    ]);
    const dv = new DataView(bytes.buffer);
    const trailer = readFrameTrailer(dv, 6);
    expect(trailer).not.toBeNull();
    expect(trailer!.hwId).toBe(9);
    expect(trailer!.fcs).toBe(0x0c40);
    expect(trailer!.fwSub).toBe("p");
  });
});
