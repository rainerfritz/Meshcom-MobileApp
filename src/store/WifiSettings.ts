import {Store} from "pullstate";

import {WifiSettings} from "../utils/AppInterfaces";

/**
    TYP: string,
    SSID: string,
    IP: string,
    GW: string,
    AP: boolean,
    DNS: string,
    SUB: string
 */

const defaultWifiSettings:WifiSettings = {
    TYP: "SW",
    SSID: "",
    IP: "0.0.0.0",
    GW: "0.0.0.0",
    AP: false,
    DNS: "0.0.0.0",
    SUB: "255.255.255.0"
}

const WifiSettingsStore = new Store({
    wifiSettings: defaultWifiSettings
});

export default WifiSettingsStore