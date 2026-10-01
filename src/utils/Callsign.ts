// Callsign helpers for amateur radio callsigns with an APRS style SSID, e.g. "OE1KFR-1".

// strips a leading zero from a two-digit SSID: "OE1KFR-02" -> "OE1KFR-2" ("-00" -> "-0")
export function normalizeCallsignSsid(call: string): string {
  return call.replace(/-0(\d)$/, "-$1");
}
