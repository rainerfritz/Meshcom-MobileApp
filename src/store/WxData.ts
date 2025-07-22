// wx-data store
import {Store} from "pullstate";

import {WxData} from "../utils/AppInterfaces";

/*
// wx sensor data interface
export interface WxData {
    TEMP: number,
    TOUT: number,
    HUM: number,
    PRES: number,
    QNH: number,
    ALT: number,
    GAS: number,
    CO2: number,
    VBUS: number,
    VSHUNT: number,
    VAMP: number,
    VPOW: number
}

*/

const defaultWxData:WxData = {
    TYP: "W",
    TEMP: 0,
    TOFFI: 0,
    TOUT: 0,
    TOFFO: 0,
    HUM: 0,
    PRES: 0,
    QNH: 0,
    ALT: 0,
    GAS: 0,
    CO2: 0,
    VBUS: 0,
    VSHUNT: 0,
    VAMP: 0,
    VPOW: 0
}

const WxDataStore = new Store({
    wxData: defaultWxData
});

export default WxDataStore
