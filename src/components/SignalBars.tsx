import { getSignalLevel } from '../utils/SignalLevel';

interface SignalBarsProps {
    rssi: number;
}

// four bars of rising height, the lit ones carry the colour of the signal quality
export const SignalBars: React.FC<SignalBarsProps> = ({ rssi }) => {
    const { bars, quality } = getSignalLevel(rssi);

    return (
        <span className={"mc-signal is-" + quality} role="img" aria-label={"Signal " + bars + " of 4 bars"}>
            {[1, 2, 3, 4].map((n) => (
                <span key={n} className={"mc-signal-bar " + (n <= bars ? "is-lit" : "")} style={{ height: 4 + n * 4 }}></span>
            ))}
        </span>
    );
};

export default SignalBars;
