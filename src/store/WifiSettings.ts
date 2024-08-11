import {Store} from "pullstate";

import {WifiSettings} from "../utils/AppInterfaces";

const defaultWifiSettings:WifiSettings = {
    TYP: "SW",
    SSID: "none",
    PW: "none",
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