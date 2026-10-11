import { REC_HIT_WINDOW_MS, REC_MIN_HITS, REC_MIN_RSSI } from "./AutoReconnectManager";
import { ReconnectResult, ReconnectState } from "../store/ReconnectStore";

// the smoothed RSSI has many decimals, the user sees one
export function formatRssi(rssi: number): string {
    return rssi.toFixed(1);
}

// text shown while a reconnect cycle runs
export function reconnectStatusText(st: Pick<ReconnectState, 'state' | 'rssi' | 'hits' | 'attempt' | 'maxAttempts'>): string {
    switch (st.state) {
        case 'searching':
            // the node is heard and the signal is good enough, the cycle only waits a moment before it connects
            if (st.rssi !== null) {
                return "Node found (" + formatRssi(st.rssi) + " dBm). Checking that the signal is stable...";
            }
            return "Searching for the node... It is not in range yet.";
        case 'weak':
            // the signal is not weak, but the node is heard only now and then: the connect request would get lost
            if (st.rssi !== null && st.rssi >= REC_MIN_RSSI && st.hits !== null) {
                const heardText = st.hits === 0
                    ? "The node was not heard in the last " + (REC_HIT_WINDOW_MS / 1000) + " s"
                    : "The node was heard only " + st.hits + " time" + (st.hits === 1 ? "" : "s") + " in " + (REC_HIT_WINDOW_MS / 1000) + " s";
                return "Link quality too low (" + formatRssi(st.rssi) + " dBm). " + heardText + ", " + REC_MIN_HITS
                    + " needed. Move closer to the node. No reconnect until then.";
            }
            return "Signal too weak (" + (st.rssi !== null ? formatRssi(st.rssi) : "?") + " dBm, " + REC_MIN_RSSI + " dBm or better needed). Move closer to the node. No reconnect until then.";
        case 'connecting':
            return "Reconnecting... (attempt " + st.attempt + "/" + st.maxAttempts
                + (st.rssi !== null ? ", " + formatRssi(st.rssi) + " dBm" : "") + ")";
        default:
            return "";
    }
}

// text of the disconnect alert after a cycle ended without connection, null: the standard text
export function reconnectResultText(result: ReconnectResult | null, rssi: number | null): string | null {
    switch (result) {
        case 'notFound':
            return "Node not in range. Move closer and reconnect manually.";
        case 'weakSignal':
            return "Signal too weak" + (rssi !== null ? " (" + formatRssi(rssi) + " dBm)" : "")
                + ". The reconnect was not tried, because the link would likely drop. Move closer to the node.";
        case 'poorLink':
            return "Link quality too low" + (rssi !== null ? " (" + formatRssi(rssi) + " dBm)" : "")
                + ": the node was heard only rarely. The reconnect was not tried, because the connection would likely fail. Move closer to the node.";
        case 'flapping':
            return "The connection keeps dropping. Check the signal strength of the node.";
        case 'failed':
            return "Reconnect failed: the connection could not be established, usually because the link quality is too low. Move closer to the node and reconnect manually.";
        default:
            return null;
    }
}
