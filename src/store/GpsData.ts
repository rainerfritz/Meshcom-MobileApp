// create pullstate store for GPS data coming as GpsData object

import {Store} from "pullstate";
import {GpsData} from "../utils/AppInterfaces";

/*
export interface GpsData {
    LAT: number,
    LON: number,
    ALT: number,
    SAT: number,
    SFIX: boolean,
    HDOP: number,
    RATE: number,
    NEXT: number,
    DIST: number,
    DIRn: number,
    DIRo: number,
    DATE: string,
    UTCOFF: number,
    GPSON: boolean,
    TRACKON: boolean
}
*/

const defaultGpsData:GpsData = {
    LAT: 0,
    LON: 0,
    ALT: 0,
    SAT: 0,
    SFIX: false,
    HDOP: 0,
    RATE: 0,
    NEXT: 0,
    DIST: 0,
    DIRn: 0,
    DIRo: 0,
    DATE: "",
    //UTCOFF: 0,
    //GPSON: false,
    //TRACKON: false
}

const GpsDataStore = new Store({
    gpsData: defaultGpsData
})

export default GpsDataStore