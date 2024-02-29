// wx-data store
import {Store} from "pullstate";

import {WxData} from "../utils/AppInterfaces";

/*
// wx sensor data interface
export interface WxData {
    BMEON: boolean,
    BME680ON: boolean,
    MCU811ON: boolean,
    LPS33ON: boolean,
    OWON: boolean,
    OWPIN: number,
    TEMP: number,
    TOUT: number,
    HUM: number,
    PRES: number,
    QNH: number,
    ALT: number,
    GAS: number,
    CO2: number
}

*/

const defaultWxData:WxData = {
    //BMEON: false,
    //BMPON: false,
    //BME680ON: false,
    //MCU811ON: false,
    //LPS33ON: false,
    //OWON: false,
    //OWPIN: 0,
    TEMP: 0,
    TOUT: 0,
    HUM: 0,
    PRES: 0,
    QNH: 0,
    ALT: 0,
    GAS: 0,
    CO2: 0
}

const WxDataStore = new Store({
    wxData: defaultWxData
});

export default WxDataStore
