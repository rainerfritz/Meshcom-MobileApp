// {"TYP":"SE","BME":false,"BMP":false,"680":true,"811":false,"LPS33":false,"OW":false,"OWPIN":4}

import {Store} from "pullstate";
import {SensorSettings} from "../utils/AppInterfaces";

/* export interface SensorSettings {
    TYP: string,
    BME: boolean,
    BMP: boolean,
    BMP3: boolean,
    BMP3F: boolean,
    AHT: boolean,
    AHTF: boolean,
    BMXF: boolean,
    "680": boolean,
    "680F": boolean,
    "811": boolean,
    "811F": boolean,
    SS: boolean,
    LPS33: boolean,
    OW: boolean,
    OWPIN: number,
    OWF: boolean,
    USERPIN: number,
    INA: boolean,
    INAF: boolean
}*/

const defaultSensorSettings:SensorSettings = {
    TYP: "",
    BME: false,
    BMP: false,
    BMP3: false,
    BMP3F: false,
    AHT: false,
    AHTF: false,
    BMXF: false,
    "680": false,
    "680F": false,
    "811": false,
    "811F": false,
    SS: false,
    LPS33: false,
    OW: false,
    OWPIN: 0,
    OWF: false,
    USERPIN: 0
}

const SensorSettingsStore = new Store({
    sensorSettings: defaultSensorSettings
})

export default SensorSettingsStore
