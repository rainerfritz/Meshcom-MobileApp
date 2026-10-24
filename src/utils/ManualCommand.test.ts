import { describe, it, expect } from "vitest";
import { checkManualCommand, MAX_MANUAL_CMD_BYTES } from "./ManualCommand";

describe("checkManualCommand", () => {
  it("accepts a command with two hyphens and trims it", () => {
    expect(checkManualCommand("  --info ")).toEqual({ ok: true, cmd: "--info", error: "" });
    expect(checkManualCommand("--settz CET-1CEST,M3.5.0,M10.5.0/3").ok).toBe(true);
  });

  it("rejects empty input", () => {
    expect(checkManualCommand("   ").ok).toBe(false);
  });

  it("rejects a missing or single hyphen", () => {
    expect(checkManualCommand("info").error).toContain("two hyphens");
    expect(checkManualCommand("-info").ok).toBe(false);
  });

  it("points at autocorrect when a long dash replaced the hyphens", () => {
    for (const dash of ["—", "–", "−", "‐‐"]) {
      const r = checkManualCommand(dash + "info");
      expect(r.ok).toBe(false);
      expect(r.error).toContain("autocorrect");
    }
  });

  it("rejects a command without a name or with three hyphens", () => {
    expect(checkManualCommand("--").ok).toBe(false);
    expect(checkManualCommand("-- info").ok).toBe(false);
    expect(checkManualCommand("---info").ok).toBe(false);
  });

  it("rejects a too long command", () => {
    expect(checkManualCommand("--" + "a".repeat(MAX_MANUAL_CMD_BYTES)).ok).toBe(false);
  });
});
