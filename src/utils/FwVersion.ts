// Firmware version check for the connected node.
// The node reports FWVER in its info JSON as "<major>.<minor> <sub letter>", e.g. "4.35 v"
// (older builds with a prefix, e.g. "C 4.29 d").

// oldest firmware the app fully works with: PN retry with complete ACK handling (4.35 v)
export const MIN_FW_VERSION = "4.35 v";

export interface FwVersion {
  major: number;
  minor: number;
  sub: string; // sub-version letter, lower case, "" if none
}

// returns null if the string holds no usable version (e.g. the "0.0.0" default before the node info arrived)
export function parseFwVersion(fwver: string | undefined | null): FwVersion | null {
  if (!fwver) return null;
  const m = /(\d+)\.(\d+)(?:\s*([A-Za-z])(?![A-Za-z0-9]))?/.exec(fwver);
  if (!m) return null;
  const major = +m[1];
  if (major === 0) return null;
  return { major, minor: +m[2], sub: (m[3] ?? "").toLowerCase() };
}

// true only if both versions are known and fwver is older than minVersion
export function isFwOlderThan(fwver: string | undefined | null, minVersion: string = MIN_FW_VERSION): boolean {
  const fw = parseFwVersion(fwver);
  const min = parseFwVersion(minVersion);
  if (!fw || !min) return false;
  if (fw.major !== min.major) return fw.major < min.major;
  if (fw.minor !== min.minor) return fw.minor < min.minor;
  return fw.sub < min.sub;
}
