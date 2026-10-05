// Callsign helpers for amateur radio callsigns with an APRS style SSID, e.g. "OE1KFR-1".

// strips a leading zero from a two-digit SSID: "OE1KFR-02" -> "OE1KFR-2" ("-00" -> "-0")
export function normalizeCallsignSsid(call: string): string {
  return call.replace(/-0(\d)$/, "-$1");
}

// The BLE name of a node is "MC-<id>-<callsign>", e.g. "MC-1c24-OE1KFR-1". Returns the callsign part,
// a name that does not follow this pattern is returned unchanged.
export function bleNodeCallsign(name: string): string {
  const m = name.match(/^MC-[0-9a-f]+-(.+)$/i);
  return m ? m[1] : name;
}

// Order of the node list: by callsign, the SSID numerically (OE1KFR-2 before OE1KFR-10), then by the full name
export function compareBleNodes(a: string, b: string): number {
  const byCall = bleNodeCallsign(a).localeCompare(bleNodeCallsign(b), undefined, { numeric: true, sensitivity: "base" });
  return byCall !== 0 ? byCall : a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
