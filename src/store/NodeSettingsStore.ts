// Node Settings Pullstate Store

import {Store} from "pullstate";

import {NodeSettings} from "../utils/AppInterfaces";

/**
 * TYP: string,
    GW: boolean,
    WS: boolean,
    DISP: boolean,
    BTN: boolean,
    MSH: boolean,
    GPS: boolean,
    TRACK: boolean,
    UTCOF: number,
    TXP: number,
    MQRG: number,
    MSF: number,
    MCR: number,
    MBW: number,
    GWNPOS: boolean,
    MHONLY: boolean,
    NOALL: boolean,
    BOOST: boolean
 */

const defaultNodeSettings:NodeSettings = {
    TYP: "SN",
    GW: false,
    WS: false,
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
    MBW: 0,
    GWNPOS: false,
    MHONLY: false,
    NOALL: false,
    BOOST: false
}

const NodeSettingsStore = new Store({
    nodeSettings: defaultNodeSettings
});

export default NodeSettingsStore