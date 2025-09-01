
import {Store} from "pullstate";
import {SensorSettingsS1} from "../utils/AppInterfaces";

/* export interface SensorSettings {
    TYP: string,
    INA226: boolean,
    SHUNT: number,
    IMAX: number,
    SAMP: number
}*/

const defaultSensorSettings:SensorSettingsS1 = {
    TYP: "",
    INA226: false,
    SHUNT: 0,
    IMAX: 0,
    SAMP: 0,
    SHT: false,
    SHTF: false
}

const SensorSettingsS1Store = new Store({
    sensorSettingsS1: defaultSensorSettings
})

export default SensorSettingsS1Store
