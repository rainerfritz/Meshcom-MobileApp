/**
 * APRS wire-format decoding, extracted into a standalone, testable module.
 *
 * Contract: /Users/martinwerner/WebDev/MeshCom-Firmware-DEV-Main/docs/architecture/11-wire-format.md
 *   §1.1 (frame layout), §1.2 (byte-5 flags), §1.8 (position comment tail,
 *   the 17 `/X=` keys), §4.3 (BLE notification framing).
 * Drift analysis this module fixes relative to the old inline parser in
 * MessageHandler.ts: docs/aprs-parser-drift-20260911.md §2-3.
 *
 * This module has no dependency on the app's stores/hooks so it can be unit
 * tested in isolation (no DOM, no React) and reused by whichever call site
 * wires it in.
 */

// ---------------------------------------------------------------------------
// Position payload parsing (§1.8)
// ---------------------------------------------------------------------------

export interface ParsedPosition {
  lat: number;
  lon: number;
  symbolTable: string;
  symbol: string;
  comment: string;
  name: string;
  alt?: number;
  bat?: number;
  pressure?: number;
  humidity?: number;
  temperature?: number;
  temp2?: number;
  qnh?: number;
  gasRes?: number;
  co2?: number;
  altPress?: number;
  dataVersion?: number;
  neighbourCount?: number;
  groups?: number[];
  din?: string;
  vbus?: number;
  vcurrent?: number;
  telemetryFlag?: boolean;
}

// Fixed-width head: ddmm.mm N|S <table> dddmm.mm E|W <symbol>
// Table char: '/' or '\' or an uppercase overlay digit/letter (§1.8.1).
// Symbol char: any printable ASCII, optional (absent only if the string
// ends exactly at the direction char).
const POSITION_HEAD_RE =
  /^(\d{2})(\d{2}\.\d{2})([NS])([/\\0-9A-Z])(\d{3})(\d{2}\.\d{2})([EW])(.?)([\s\S]*)$/;

/** One match's captured value and where it starts in the tail string. */
interface KeyHit {
  value: string;
  start: number;
}

/**
 * Runs a global, capturing key regex over the tail and returns the LAST
 * match's value (per the wire-format rule: repeated keys, last wins) plus
 * the FIRST match's start index (used to bound the free-text comment).
 * A key with a validity predicate that rejects a given occurrence treats
 * that occurrence as if it were absent for "last wins" purposes, but it
 * still counts for the comment boundary (real fields, valid or not, are
 * still `/X=` tokens and end the comment).
 */
function scanKey(
  tail: string,
  re: RegExp,
  isValid: (value: string) => boolean = () => true
): { lastValid?: string; firstStart?: number } {
  re.lastIndex = 0;
  let firstStart: number | undefined;
  let lastValid: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail)) !== null) {
    if (firstStart === undefined) firstStart = m.index;
    if (isValid(m[1])) lastValid = m[1];
    if (m[0].length === 0) re.lastIndex += 1; // guard against zero-width loops
  }
  return { lastValid, firstStart };
}

function convertAltFeetToMetres(feet: string): number {
  return Math.round(parseFloat(feet) * 0.3048);
}

/**
 * Parses the position payload that follows the `!` type byte of a §1.1
 * frame, e.g. "4812.34N/01143.56E#comment/B=085/A=001526...".
 * Returns null when the fixed-width lat/lon/table/symbol head does not
 * match (garbage input, truncated frame, etc.).
 */
export function parsePositionPayload(text: string): ParsedPosition | null {
  const head = POSITION_HEAD_RE.exec(text);
  if (!head) return null;

  const [
    ,
    latDegStr,
    latMinStr,
    latDir,
    symbolTable,
    lonDegStr,
    lonMinStr,
    lonDir,
    symbol,
    tail,
  ] = head;

  let lat = parseInt(latDegStr, 10) + parseFloat(latMinStr) / 60;
  let lon = parseInt(lonDegStr, 10) + parseFloat(lonMinStr) / 60;
  if (latDir === "S") lat = -lat;
  if (lonDir === "W") lon = -lon;
  lat = Math.round(lat * 10000) / 10000;
  lon = Math.round(lon * 10000) / 10000;

  // Each key's value regex, per the PARSING RULES: numeric keys default to
  // `-?[\d.]+`; /A=, /B=, /N, /R=, /D= have their own documented shapes.
  const keys = {
    A: scanKey(tail, /\/A=(\d{6})/g),
    B: scanKey(tail, /\/B=(\d{1,3})/g, (v) => parseInt(v, 10) <= 100),
    P: scanKey(tail, /\/P=(-?[\d.]+)/g),
    H: scanKey(tail, /\/H=(-?[\d.]+)/g),
    T: scanKey(tail, /\/T=(-?[\d.]+)/g),
    O: scanKey(tail, /\/O=(-?[\d.]+)/g),
    F: scanKey(tail, /\/F=(-?[\d.]+)/g),
    Q: scanKey(tail, /\/Q=(-?[\d.]+)/g),
    G: scanKey(tail, /\/G=(-?[\d.]+)/g),
    C: scanKey(tail, /\/C=(-?[\d.]+)/g),
    V: scanKey(tail, /\/V=(-?[\d.]+)/g),
    // /N has no "=" on the wire and must be followed by "/", a space, or end.
    N: scanKey(tail, /\/N(\d{1,2})(?=[/ ]|$)/g),
    R: scanKey(tail, /\/R=((?:\d{1,5};?){1,6})/g),
    Y: scanKey(tail, /\/Y=(-?[\d.]+)/g),
    // /D= requires exactly 8 binary chars followed by "/", a space, or end;
    // 7, 9+, or non-binary content simply never matches (din stays undefined).
    D: scanKey(tail, /\/D=([01]{8})(?=[/ ]|$)/g),
    U: scanKey(tail, /\/U=(-?[\d.]+)/g),
    I: scanKey(tail, /\/I=(-?[\d.]+)/g),
  };

  // The comment is everything up to the first `/X=` (or `/N<digit>`) token
  // found anywhere in the tail, scanning left to right (§1.8.3/§1.8.5) —
  // never split('/'), a free-text comment may itself contain '/'.
  let commentEnd = tail.length;
  for (const k of Object.values(keys)) {
    if (k.firstStart !== undefined && k.firstStart < commentEnd) {
      commentEnd = k.firstStart;
    }
  }
  const region = tail.slice(0, commentEnd);

  // The node name, when present, is appended after the free-text comment as
  // `#name` (the firmware forbids `#` in the name field, so splitting on the
  // LAST `#` in the region is unambiguous even though a `#` inside the
  // free-text comment itself stays legal). No `#` -> name "", comment as-is.
  const nameSep = region.lastIndexOf("#");
  const comment = nameSep === -1 ? region : region.slice(0, nameSep);
  const name = nameSep === -1 ? "" : region.slice(nameSep + 1);

  const result: ParsedPosition = {
    lat,
    lon,
    symbolTable,
    symbol: symbol ?? "",
    comment,
    name,
  };

  if (keys.A.lastValid !== undefined) result.alt = convertAltFeetToMetres(keys.A.lastValid);
  if (keys.B.lastValid !== undefined) result.bat = parseInt(keys.B.lastValid, 10);
  if (keys.P.lastValid !== undefined) result.pressure = parseFloat(keys.P.lastValid);
  if (keys.H.lastValid !== undefined) result.humidity = parseFloat(keys.H.lastValid);
  if (keys.T.lastValid !== undefined) result.temperature = parseFloat(keys.T.lastValid);
  if (keys.O.lastValid !== undefined) result.temp2 = parseFloat(keys.O.lastValid);
  if (keys.F.lastValid !== undefined) result.altPress = parseFloat(keys.F.lastValid);
  if (keys.Q.lastValid !== undefined) result.qnh = parseFloat(keys.Q.lastValid);
  if (keys.G.lastValid !== undefined) result.gasRes = parseFloat(keys.G.lastValid);
  if (keys.C.lastValid !== undefined) result.co2 = parseFloat(keys.C.lastValid);
  if (keys.V.lastValid !== undefined) result.dataVersion = parseFloat(keys.V.lastValid);
  if (keys.N.lastValid !== undefined) result.neighbourCount = parseInt(keys.N.lastValid, 10);
  if (keys.R.lastValid !== undefined) {
    result.groups = keys.R.lastValid
      .split(";")
      .filter((s) => s !== "")
      .map((s) => parseInt(s, 10));
  }
  if (keys.Y.lastValid !== undefined) result.telemetryFlag = parseFloat(keys.Y.lastValid) !== 0;
  if (keys.D.lastValid !== undefined) result.din = keys.D.lastValid;
  if (keys.U.lastValid !== undefined) result.vbus = parseFloat(keys.U.lastValid);
  if (keys.I.lastValid !== undefined) result.vcurrent = parseFloat(keys.I.lastValid);

  return result;
}

// ---------------------------------------------------------------------------
// Frame trailer (§1.1)
// ---------------------------------------------------------------------------

export interface FrameTrailer {
  hwId: number;
  mod: number;
  fcs: number;
  fw?: number;
  lastHw?: number;
  fwSub?: string;
}

/**
 * Reads the frame trailer that follows the 0x00 payload terminator:
 * HW, MOD, FCS hi, FCS lo, then the optional FW / LASTHW / FW-sub / 0x7E
 * group, which the decoder must tolerate being absent (§1.1).
 * `zeroIndex` is the index of the 0x00 terminator within `dv`.
 */
export function readFrameTrailer(dv: DataView, zeroIndex: number): FrameTrailer | null {
  if (zeroIndex < 0 || zeroIndex >= dv.byteLength) return null;
  // Need HW, MOD, FCS-hi, FCS-lo: offsets zeroIndex+1..zeroIndex+4.
  if (dv.byteLength < zeroIndex + 5) return null;

  const hwId = dv.getUint8(zeroIndex + 1);
  const mod = dv.getUint8(zeroIndex + 2);
  const fcs = dv.getUint16(zeroIndex + 3, false); // big-endian

  const trailer: FrameTrailer = { hwId, mod, fcs };

  // Optional FW / LASTHW / FW-sub / 0x7E, only if all four bytes are present.
  if (dv.byteLength >= zeroIndex + 9) {
    const fw = dv.getUint8(zeroIndex + 5);
    const lastHw = dv.getUint8(zeroIndex + 6);
    let fwSubByte = dv.getUint8(zeroIndex + 7);
    // 0x00 and 0x7E are read back as '#' (§1.1).
    if (fwSubByte === 0x00 || fwSubByte === 0x7e) fwSubByte = 0x23; // '#'
    trailer.fw = fw;
    trailer.lastHw = lastHw;
    trailer.fwSub = String.fromCharCode(fwSubByte);
  }

  return trailer;
}

// ---------------------------------------------------------------------------
// msg_id, flags, node timestamp (§1.1, §1.2, §4.3)
// ---------------------------------------------------------------------------

/** msg_id is written LITTLE-endian on the wire (§1.1) — not big-endian. */
export function readMsgId(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true);
}

export interface FrameFlags {
  maxHop: number;
  mesh: boolean;
  appOffline: boolean;
  track: boolean;
  server: boolean;
}

/** Decodes byte 5: flags + hop nibble (§1.2). */
export function decodeFlags(b: number): FrameFlags {
  return {
    maxHop: b & 0x0f,
    mesh: (b & 0x10) !== 0,
    appOffline: (b & 0x20) !== 0,
    track: (b & 0x40) !== 0,
    server: (b & 0x80) !== 0,
  };
}

const TIMESTAMP_FLOOR_MS = Date.UTC(2024, 0, 1); // 2024-01-01T00:00:00Z
const TIMESTAMP_CEIL_SLACK_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the 4-byte BIG-endian unix timestamp (seconds) that a BLE data
 * notification appends after the raw LoRa frame, one pad byte before the
 * very end (§4.3): bytes at dv.byteLength-5 .. dv.byteLength-2.
 * Returns null when the value falls outside [2024-01-01, now+24h] — the
 * node has no better clock yet and is still on its epoch default.
 */
export function readNodeTimestampMs(dv: DataView): number | null {
  if (dv.byteLength < 5) return null;
  const seconds = dv.getUint32(dv.byteLength - 5, false); // big-endian
  const ms = seconds * 1000;
  const now = Date.now();
  if (ms < TIMESTAMP_FLOOR_MS || ms > now + TIMESTAMP_CEIL_SLACK_MS) return null;
  return ms;
}
