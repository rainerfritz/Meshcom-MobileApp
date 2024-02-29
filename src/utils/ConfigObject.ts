import { InfoData } from "./AppInterfaces";
import ConfigStore from "../store/ConfStore";

class ConfClass{

    infodata_obj:InfoData;
    ble_dev_id:string = "00:00:00:00:00:00";

    constructor(){
        this.infodata_obj = {
            FWVER: "0.0.0",
            CALL: "XX",
            ID: "00",
            HWID: 0,
            MAXV: 0,
            ATXT: "none",
            BLE: "none",
            BATP: 0,
            BATV: 0
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
}

export default new ConfClass();