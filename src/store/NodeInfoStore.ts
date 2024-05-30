// Node Info Store

import {Store} from "pullstate";

import {InfoData} from "../utils/AppInterfaces";

const defaultInfoData:InfoData = {
    FWVER: "0.0.0",
    CALL: "XX",
    ID: "00",
    HWID: 0,
    MAXV: 0,
    ATXT: "none",
    BLE: "none",
    BATP: 0,
    BATV: 0,
    GCH: 0,
    GCB0: 0,
    GCB1: 0,
    GCB2: 0,
    GCB3: 0,
    GCB4: 0,
    CTRY: "none"
}

const NodeInfoStore = new Store({
    infoData: defaultInfoData
});

export default NodeInfoStore