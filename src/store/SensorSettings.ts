// {"TYP":"SE","BME":false,"BMP":false,"680":true,"811":false,"LPS33":false,"OW":false,"OWPIN":4}

import {Store} from "pullstate";
import {SensorSettings} from "../utils/AppInterfaces";

/* export interface SensorSettings {
    TYP: string,
    BME: boolean,
    BMP: boolean,
    "680": boolean,
    "811": boolean,
    LPS33: boolean,
    OW: boolean,
    OWPIN: number,
    USERPIN: number
}*/

const defaultSensorSettings:SensorSettings = {
    TYP: "",
    BME: false,
    BMP: false,
    "680": false,
    "811": false,
    LPS33: false,
    OW: false,
    OWPIN: 0,
    USERPIN: 0
}

const SensorSettingsStore = new Store({
    sensorSettings: defaultSensorSettings
})

export default SensorSettingsStore
