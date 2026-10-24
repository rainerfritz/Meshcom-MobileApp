// Full charge voltage of the battery (--maxv). The boards run single cell LiIon packs, so only
// 3.7 .. 4.5 V make sense for the setting.

export const MAXV_MIN = 3.7;
export const MAXV_MAX = 4.5;

export interface MaxVoltageCheck {
  ok: boolean,
  value: number,
  error: string
}

// the node setting can be edited here only when it is a single cell value
export const isSingleCellMaxV = (v: number | undefined | null): boolean =>
  typeof v === "number" && v >= MAXV_MIN && v <= MAXV_MAX;

// input as typed, a decimal comma is fine
export const checkMaxVoltage = (input: string): MaxVoltageCheck => {
  const t = input.trim().replace(",", ".");
  if (t === "" || isNaN(+t)) {
    return { ok: false, value: 0, error: "Please enter the voltage as a number, e.g. 4.2." };
  }
  const value = +t;
  if (value < MAXV_MIN || value > MAXV_MAX) {
    return { ok: false, value, error: "The voltage has to be between " + MAXV_MIN + " and " + MAXV_MAX + " V." };
  }
  return { ok: true, value, error: "" };
};
