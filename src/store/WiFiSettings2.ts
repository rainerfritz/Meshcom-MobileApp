import {Store} from "pullstate";

import {WifiSettings2} from "../utils/AppInterfaces";

/**
    TYP: string,
    OWNIP: string,
    OWNGW: string,
    OWNMS: string,
    OWNDNS: string,
    OWNNTP: string,
    EUDP: boolean,
    EUDPIP: string,
    TXPOW: number
 */

const defaultWifiSettings:WifiSettings2 = {
    TYP: "SW2",
    OWNIP: "0.0.0.0",
    OWNGW: "0.0.0.0",
    OWNMS: "255.255.255.0",
    OWNDNS: "0.0.0.0",
    OWNNTP: "0.0.0.0",
    EUDP: false,
    EUDPIP: "0.0.0.0",
    TXPOW: 0
}

const WifiSettingsStore2 = new Store({
    wifiSettings2: defaultWifiSettings
});

export default WifiSettingsStore2