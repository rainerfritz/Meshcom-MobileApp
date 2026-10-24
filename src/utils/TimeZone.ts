// POSIX TZ rules for the node (--settz). The node switches between standard and daylight time by itself.
// The strings are the ones listed in the firmware doc docs/timezones.md. Offsets are POSIX style,
// west positive: "CET-1" is UTC+1.

export interface TzPreset {
  id: string,     // IANA zone name, used as the select value
  label: string,
  tz: string
}

export const TZ_PRESETS: TzPreset[] = [
  { id: "Europe/Vienna", label: "Europe - Vienna (CET, also Berlin, Zurich, Rome ...)", tz: "CET-1CEST,M3.5.0,M10.5.0/3" },
  { id: "Europe/London", label: "Europe - London", tz: "GMT0BST,M3.5.0/1,M10.5.0" },
  { id: "Europe/Dublin", label: "Europe - Dublin", tz: "GMT0IST,M3.5.0/1,M10.5.0" },
  { id: "Europe/Lisbon", label: "Europe - Lisbon", tz: "WET0WEST,M3.5.0/1,M10.5.0" },
  { id: "Europe/Athens", label: "Europe - Athens (EET, also Helsinki, Kyiv ...)", tz: "EET-2EEST,M3.5.0/3,M10.5.0/4" },
  { id: "Europe/Moscow", label: "Europe - Moscow", tz: "MSK-3" },
  { id: "Europe/Istanbul", label: "Europe - Istanbul", tz: "<+03>-3" },
  { id: "Atlantic/Reykjavik", label: "Europe - Reykjavik", tz: "GMT0" },
  { id: "America/New_York", label: "America - New York (Eastern)", tz: "EST5EDT,M3.2.0,M11.1.0" },
  { id: "America/Chicago", label: "America - Chicago (Central)", tz: "CST6CDT,M3.2.0,M11.1.0" },
  { id: "America/Denver", label: "America - Denver (Mountain)", tz: "MST7MDT,M3.2.0,M11.1.0" },
  { id: "America/Phoenix", label: "America - Phoenix (no DST)", tz: "MST7" },
  { id: "America/Los_Angeles", label: "America - Los Angeles (Pacific)", tz: "PST8PDT,M3.2.0,M11.1.0" },
  { id: "America/Sao_Paulo", label: "America - Sao Paulo", tz: "<-03>3" },
  { id: "Africa/Johannesburg", label: "Africa - Johannesburg", tz: "SAST-2" },
  { id: "Asia/Dubai", label: "Asia - Dubai", tz: "<+04>-4" },
  { id: "Asia/Kolkata", label: "Asia - Kolkata", tz: "<+0530>-5:30" },
  { id: "Asia/Shanghai", label: "Asia - Shanghai", tz: "CST-8" },
  { id: "Asia/Tokyo", label: "Asia - Tokyo", tz: "JST-9" },
  { id: "Australia/Sydney", label: "Australia - Sydney (also Melbourne)", tz: "AEST-10AEDT,M10.1.0,M4.1.0/3" },
  { id: "Australia/Perth", label: "Australia - Perth", tz: "AWST-8" },
  { id: "Pacific/Auckland", label: "New Zealand - Auckland", tz: "NZST-12NZDT,M9.5.0,M4.1.0/3" },
  { id: "UTC", label: "UTC", tz: "UTC0" }
];

// the node stores at most 39 characters (char[40])
export const MAX_TZ_CHARS = 39;

// preset that belongs to a rule string, undefined for a custom rule
export const findTzPreset = (tz: string | undefined | null): TzPreset | undefined =>
  tz ? TZ_PRESETS.find(p => p.tz === tz.trim()) : undefined;

// Pre-check of a rule before it is sent, the node checks it again and silently ignores a bad rule.
// Returns an error text, or "" if the rule looks fine.
export const checkTzRule = (tz: string): string => {
  const t = tz.trim();
  if (t === "") return "Please enter a time zone rule.";
  if (t.length > MAX_TZ_CHARS) return "Too long, max " + MAX_TZ_CHARS + " characters.";
  if (/\s/.test(t)) return "The rule must not contain spaces.";
  if (/,\s*J?\d/.test(t)) return "Only M rules are supported (Mm.w.d).";
  return "";
};
