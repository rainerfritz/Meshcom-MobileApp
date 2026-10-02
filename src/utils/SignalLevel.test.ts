import { describe, it, expect } from 'vitest';
import { getSignalLevel } from './SignalLevel';

describe('getSignalLevel', () => {
    it('rates -70 dBm and stronger as super with four bars', () => {
        expect(getSignalLevel(-40)).toEqual({ bars: 4, quality: 'super' });
        expect(getSignalLevel(-70)).toEqual({ bars: 4, quality: 'super' });
    });

    it('rates -71 to -80 dBm as good with three bars', () => {
        expect(getSignalLevel(-71)).toEqual({ bars: 3, quality: 'good' });
        expect(getSignalLevel(-80)).toEqual({ bars: 3, quality: 'good' });
    });

    it('rates -81 to -90 dBm as ok with two bars', () => {
        expect(getSignalLevel(-81)).toEqual({ bars: 2, quality: 'ok' });
        expect(getSignalLevel(-90)).toEqual({ bars: 2, quality: 'ok' });
    });

    it('rates -91 to -110 dBm as weak with one bar', () => {
        expect(getSignalLevel(-91)).toEqual({ bars: 1, quality: 'weak' });
        expect(getSignalLevel(-110)).toEqual({ bars: 1, quality: 'weak' });
    });

    it('rates anything below -110 dBm as bad with one bar', () => {
        expect(getSignalLevel(-111)).toEqual({ bars: 1, quality: 'bad' });
        expect(getSignalLevel(-127)).toEqual({ bars: 1, quality: 'bad' });
    });
});
