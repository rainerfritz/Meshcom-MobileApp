import { describe, it, expect } from "vitest";
import { TZ_PRESETS, checkTzRule, findTzPreset, MAX_TZ_CHARS } from "./TimeZone";

describe("TimeZone", () => {
  it("has Vienna as the first preset", () => {
    expect(TZ_PRESETS[0].id).toBe("Europe/Vienna");
    expect(TZ_PRESETS[0].tz).toBe("CET-1CEST,M3.5.0,M10.5.0/3");
  });

  it("all presets pass the pre-check", () => {
    TZ_PRESETS.forEach(p => expect(checkTzRule(p.tz)).toBe(""));
  });

  it("finds a preset by rule", () => {
    expect(findTzPreset("CET-1CEST,M3.5.0,M10.5.0/3")?.id).toBe("Europe/Vienna");
    expect(findTzPreset("XYZ1")).toBeUndefined();
    expect(findTzPreset("")).toBeUndefined();
    expect(findTzPreset(undefined)).toBeUndefined();
  });

  it("rejects bad rules", () => {
    expect(checkTzRule("")).not.toBe("");
    expect(checkTzRule("CET-1CEST,J60,J300")).not.toBe("");
    expect(checkTzRule("CET-1CEST,59,300")).not.toBe("");
    expect(checkTzRule("CET -1")).not.toBe("");
    expect(checkTzRule("A".repeat(MAX_TZ_CHARS + 1))).not.toBe("");
  });
});
