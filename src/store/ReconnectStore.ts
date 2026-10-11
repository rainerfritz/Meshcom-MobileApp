import { Store } from "pullstate";

// why a reconnect cycle ended without a connection (drives the text of the disconnect alert)
// weakSignal: heard only below the minimum RSSI, poorLink: heard with a fine RSSI but too rarely (hit rate)
export type ReconnectResult = 'notFound' | 'weakSignal' | 'poorLink' | 'failed' | 'flapping' | 'cancelled';

export interface ReconnectState {
    // user setting, stored in the DB. Default is OFF, the user has to enable it
    enabled: boolean;
    // last node we were fully connected to
    lastDeviceId: string;
    // searching: node not heard yet, weak: heard but signal below the minimum, connecting: connect attempt running
    state: 'idle' | 'searching' | 'weak' | 'connecting';
    // smoothed RSSI of the node while a cycle runs, null if not heard
    rssi: number | null;
    // adverts of the node heard in the last few seconds (hit rate), null if not heard
    hits: number | null;
    attempt: number;
    maxAttempts: number;
    // set when a cycle ended without connection, null otherwise
    lastResult: ReconnectResult | null;
}

export const defaultReconnectState: ReconnectState = {
    enabled: false,
    lastDeviceId: "",
    state: 'idle',
    rssi: null,
    hits: null,
    attempt: 0,
    maxAttempts: 0,
    lastResult: null,
};

const ReconnectStore = new Store<ReconnectState>({ ...defaultReconnectState });

export default ReconnectStore;
