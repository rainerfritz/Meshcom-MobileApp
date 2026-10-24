import { describe, it, expect } from "vitest";
import { checkMaxVoltage, isSingleCellMaxV } from "./MaxVoltage";

describe("MaxVoltage", () => {
  it("accepts values between 3.7 and 4.5 V, also with a decimal comma", () => {
    expect(checkMaxVoltage("4.2")).toEqual({ ok: true, value: 4.2, error: "" });
    expect(checkMaxVoltage(" 4,125 ").value).toBe(4.125);
    expect(checkMaxVoltage("3.7").ok).toBe(true);
    expect(checkMaxVoltage("4.5").ok).toBe(true);
  });

  it("rejects values outside the range and non numbers", () => {
    expect(checkMaxVoltage("3.6").ok).toBe(false);
    expect(checkMaxVoltage("4.6").ok).toBe(false);
    expect(checkMaxVoltage("8.4").ok).toBe(false);
    expect(checkMaxVoltage("").ok).toBe(false);
    expect(checkMaxVoltage("abc").ok).toBe(false);
  });

  it("knows single cell values", () => {
    expect(isSingleCellMaxV(4.2)).toBe(true);
    expect(isSingleCellMaxV(8.4)).toBe(false);
    expect(isSingleCellMaxV(0)).toBe(false);
    expect(isSingleCellMaxV(undefined)).toBe(false);
  });
});
