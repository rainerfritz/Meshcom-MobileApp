import { describe, it, expect } from "vitest";
import { checkNetPassword, MAX_NET_PWD_CHARS } from "./NetPassword";

describe("checkNetPassword", () => {
  it("accepts a password and trims it", () => {
    expect(checkNetPassword("  secret ")).toEqual({ ok: true, pwd: "secret", error: "" });
    expect(checkNetPassword("a".repeat(MAX_NET_PWD_CHARS)).ok).toBe(true);
  });

  it("rejects empty, too long and the clear word", () => {
    expect(checkNetPassword("   ").ok).toBe(false);
    expect(checkNetPassword("a".repeat(MAX_NET_PWD_CHARS + 1)).ok).toBe(false);
    expect(checkNetPassword("none").ok).toBe(false);
    expect(checkNetPassword("NONE").ok).toBe(false);
  });
});
