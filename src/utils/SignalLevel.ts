/**
 * Signal strength of a BLE node as seen by the phone, shown as four bars next to the RSSI.
 * RSSI in dBm: >= -70 super, >= -80 good, >= -90 ok, weaker is bad (orange down to -110, red below).
 */
export type SignalQuality = 'super' | 'good' | 'ok' | 'weak' | 'bad';

export interface SignalLevel {
    bars: 1 | 2 | 3 | 4,
    quality: SignalQuality
}

export const getSignalLevel = (rssi: number): SignalLevel => {
    if (rssi >= -70) return { bars: 4, quality: 'super' };
    if (rssi >= -80) return { bars: 3, quality: 'good' };
    if (rssi >= -90) return { bars: 2, quality: 'ok' };
    if (rssi >= -110) return { bars: 1, quality: 'weak' };
    return { bars: 1, quality: 'bad' };
};
