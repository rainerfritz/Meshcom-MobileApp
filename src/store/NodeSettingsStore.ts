// Node Settings Pullstate Store

import {Store} from "pullstate";

import {NodeSettings} from "../utils/AppInterfaces";

const defaultNodeSettings:NodeSettings = {
    TYP: "SN",
    GW: false,
    DISP: true,
    BTN: false,
    MSH: true,
    GPS: false,
    TRACK: false,
    UTCOF: 0,
    TXP: 0,
    MQRG: 0,
    MSF: 0,
    MCR: 0,
    MBW: 0
}

const NodeSettingsStore = new Store({
    nodeSettings: defaultNodeSettings
});

export default NodeSettingsStore