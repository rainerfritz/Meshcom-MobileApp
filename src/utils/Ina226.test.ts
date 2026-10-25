import { describe, it, expect } from "vitest";
import { checkIna226, inaNumText, inaSampleLabel } from "./Ina226";

describe("Ina226", () => {
  it("accepts shunt and imax in range, also with a decimal comma", () => {
    expect(checkIna226("0,1", "5")).toMatchObject({ ok: true, shunt: 0.1, imax: 5 });
    expect(checkIna226("0.002", "0").ok).toBe(true);
    expect(checkIna226("0.499", "20").ok).toBe(true);
  });

  it("rejects values outside the firmware ranges", () => {
    expect(checkIna226("0.001", "5").ok).toBe(false);
    expect(checkIna226("0.5", "5").ok).toBe(false);
    expect(checkIna226("", "5").ok).toBe(false);
    expect(checkIna226("0.1", "21").ok).toBe(false);
    expect(checkIna226("0.1", "-1").ok).toBe(false);
    expect(checkIna226("0.1", "abc").ok).toBe(false);
  });

  it("formats node values without float noise", () => {
    expect(inaNumText(0.10000000149)).toBe("0.1");
    expect(inaNumText(5)).toBe("5");
    expect(inaNumText(undefined)).toBe("");
  });

  it("labels the samples", () => {
    expect(inaSampleLabel(0)).toBe("0 (1 samples)");
    expect(inaSampleLabel(7)).toBe("7 (1024 samples)");
  });
});
