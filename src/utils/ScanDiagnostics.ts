/**
 * Diagnostics of the live BLE scan: how often each MeshCom node was heard in a time window.
 * It answers "why was the node not on the display": no advert came in (node or radio), or the advert came in
 * without a name, or the scan itself delivered nothing (compare with the results of all devices).
 * It only counts, the caller logs the lines from report().
 */

interface NodeStat {
    label: string;
    lastAdvAt: number | null;   // last advert since the scan started, survives the report
    count: number;              // adverts in the current window
    nameless: number;           // of those, adverts the stack delivered without a name
    maxGap: number;             // longest pause between two adverts that ended in this window (ms)
    rssiMin: number;
    rssiMax: number;
}

export interface DiagWatchNode {
    id: string;
    label: string;
}

export class ScanDiagnostics {
    private nodes = new Map<string, NodeStat>();
    private total = 0;
    private scanStartedAt = 0;
    private windowStart = 0;

    /** the scan (re)starts: everything starts from zero, a pause with the scan stopped is no gap */
    start(now: number) {
        this.nodes.clear();
        this.total = 0;
        this.scanStartedAt = now;
        this.windowStart = now;
    }

    /** any scan result, of any device */
    anyResult() {
        this.total++;
    }

    /** an advert of a MeshCom node (or the node we want to reconnect to) */
    nodeResult(id: string, label: string, now: number, rssi: number, hadName: boolean) {
        let st = this.nodes.get(id);
        if (!st) {
            st = { label, lastAdvAt: null, count: 0, nameless: 0, maxGap: 0, rssiMin: rssi, rssiMax: rssi };
            this.nodes.set(id, st);
        }
        st.label = label;

        // the first advert of a scan counts from the scan start
        const since = st.lastAdvAt ?? this.scanStartedAt;
        st.maxGap = Math.max(st.maxGap, now - since);
        st.lastAdvAt = now;

        if (st.count === 0) {
            st.rssiMin = rssi;
            st.rssiMax = rssi;
        } else {
            st.rssiMin = Math.min(st.rssiMin, rssi);
            st.rssiMax = Math.max(st.rssiMax, rssi);
        }
        st.count++;
        if (!hadName) st.nameless++;
    }

    /**
     * One line per node of the window that ends now, and a new window starts.
     * `watch` are nodes that get a line even when they were not heard at all (the node we reconnect to).
     * `staleMs` is the time after which the list drops a device.
     */
    report(now: number, staleMs: number, watch: DiagWatchNode[] = []): string[] {
        const ids = new Set<string>(this.nodes.keys());
        const labels = new Map<string, string>();
        this.nodes.forEach((st, id) => labels.set(id, st.label));
        for (const w of watch) {
            ids.add(w.id);
            if (!labels.has(w.id)) labels.set(w.id, w.label);
        }

        const windowS = Math.round((now - this.windowStart) / 1000);
        const tail = " | scan running " + Math.round((now - this.scanStartedAt) / 1000) + " s, "
            + this.total + " results of all devices";
        const lines: string[] = [];

        ids.forEach((id) => {
            const st = this.nodes.get(id);
            let text = "[SCAN] " + labels.get(id) + ": ";

            if (st && st.count > 0) {
                text += st.count + " adverts in " + windowS + " s"
                    + (st.nameless > 0 ? " (" + st.nameless + " without name)" : "")
                    + ", max gap " + (st.maxGap / 1000).toFixed(1) + " s"
                    + ", rssi " + st.rssiMin + ".." + st.rssiMax;
            } else {
                text += "0 adverts in " + windowS + " s";
            }

            if (st && st.lastAdvAt !== null) {
                const age = now - st.lastAdvAt;
                text += ", last heard " + (age / 1000).toFixed(1) + " s ago, "
                    + (age <= staleMs ? "in the list" : "NOT in the list");
            } else {
                text += ", not heard since the scan started, NOT in the list";
            }

            lines.push(text + tail);

            if (st) {
                st.count = 0;
                st.nameless = 0;
                st.maxGap = 0;
            }
        });

        this.total = 0;
        this.windowStart = now;
        return lines;
    }
}

export default ScanDiagnostics;
