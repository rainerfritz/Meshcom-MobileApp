
import {Store} from "pullstate";
import {SensorSettingsS1} from "../utils/AppInterfaces";

/* export interface SensorSettings {
            sensdoc1["TYP"] = "S1";
        sensdoc1["INA226"] = ina226_found;
        sensdoc1["SHUNT"] = meshcom_settings.node_shunt;
        sensdoc1["IMAX"] = meshcom_settings.node_imax;
        sensdoc1["SAMP"] = meshcom_settings.node_isamp;
        sensdoc1["SHT"] = bSHT21ON;
        sensdoc1["SHTF"] = sht21_found;
        sensdoc1["226"] = bINA226ON;
        sensdoc1["226F"] = ina226_found;
}*/

const defaultSensorSettings:SensorSettingsS1 = {
    TYP: "",
    INA226: false,
    SHUNT: 0,
    IMAX: 0,
    SAMP: 0,
    SHT: false,
    SHTF: false,
    "226": false,
    "226F": false
}

const SensorSettingsS1Store = new Store({
    sensorSettingsS1: defaultSensorSettings
})

export default SensorSettingsS1Store
