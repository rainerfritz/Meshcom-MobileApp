// INA226 current sensor settings of the node (--shunt, --imax, --isamp), ranges as the firmware checks them.

export const INA_SHUNT_MIN = 0.001;   // ohm, the firmware wants more than this
export const INA_SHUNT_MAX = 0.5;     // ohm, and less than this for the sensor setup
export const INA_IMAX_MAX = 20;       // A
export const INA_SAMPLES = [0, 1, 2, 3, 4, 5, 6, 7];

// INA226 averaging register value -> number of averaged samples, for the dropdown text
const SAMPLE_COUNT = [1, 4, 16, 64, 128, 256, 512, 1024];
export const inaSampleLabel = (v: number): string =>
  v + (SAMPLE_COUNT[v] !== undefined ? " (" + SAMPLE_COUNT[v] + " samples)" : "");

// number as typed, a decimal comma is fine. NaN for anything else
const toNum = (t: string): number => {
  const s = t.trim().replace(",", ".");
  return s === "" ? NaN : +s;
};

export interface InaCheck {
  ok: boolean,
  shunt: number,
  imax: number,
  error: string
}

export const checkIna226 = (shuntText: string, imaxText: string): InaCheck => {
  const shunt = toNum(shuntText);
  const imax = toNum(imaxText);
  if (isNaN(shunt) || shunt <= INA_SHUNT_MIN || shunt >= INA_SHUNT_MAX) {
    return { ok: false, shunt, imax, error: "The shunt has to be more than " + INA_SHUNT_MIN + " and less than " + INA_SHUNT_MAX + " Ohm." };
  }
  if (isNaN(imax) || imax < 0 || imax > INA_IMAX_MAX) {
    return { ok: false, shunt, imax, error: "The max. current has to be between 0 and " + INA_IMAX_MAX + " A." };
  }
  return { ok: true, shunt, imax, error: "" };
};

// value from the node as text for an input, without float noise (0.100000001 -> 0.1)
export const inaNumText = (v: number | undefined): string =>
  v === undefined || isNaN(v) ? "" : String(parseFloat(v.toPrecision(6)));

// INA226 readings for the Info page, in the units the node sends (VBUS V, VSHUNT mV, VAMP mA,
// VPOW mW) and with the decimals of the node's web UI
export interface InaValues {
  VBUS: number,
  VSHUNT: number,
  VAMP: number,
  VPOW: number
}

export const inaReadings = (wx: InaValues): [string, string][] => [
  ["VBUS", wx.VBUS.toFixed(2) + " V"],
  ["VSHUNT", wx.VSHUNT.toFixed(2) + " mV"],
  ["VAMP", wx.VAMP.toFixed(1) + " mA"],
  ["VPOW", wx.VPOW.toFixed(1) + " mW"],
];
