import { InfoData } from "./AppInterfaces";
import ConfigStore from "../store/ConfStore";
import { GpsData } from "./AppInterfaces";

class ConfClass{

    infodata_obj:InfoData;
    ble_dev_id:string = "00:00:00:00:00:00";
    own_position:GpsData;

    constructor(){
        this.infodata_obj = {
            FWVER: "0.0.0",
            CALL: "",
            ID: "00",
            HWID: 0,
            MAXV: 0,
            ATXT: "none",
            BLE: "none",
            BATP: 0,
            BATV: 0
        }
        this.own_position = {
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
        }
    }

    getConf(){
        return this.infodata_obj;
    }

    setConf(conf:InfoData){
        this.infodata_obj = conf;
    }

    getBleDevId(){
        return this.ble_dev_id;
    }

    setBleDevId(id:string){
        this.ble_dev_id = id;
    }

    getOwnPosition(){
        return this.own_position;
    }

    setOwnPosition(pos:GpsData){
        this.own_position = pos;
    }
}

export default new ConfClass();