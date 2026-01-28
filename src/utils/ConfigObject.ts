import { InfoData } from "./AppInterfaces";
import ConfigStore from "../store/ConfStore";
import { GpsData } from "./AppInterfaces";

class ConfClass{

    infodata_obj:InfoData;
    ble_dev_id:string = "00:00:00:00:00:00";
    own_position:GpsData;
    initialChatSegmentMarkers: string[] = []; // stores the chat segments in chat page while connect when loading txt msgs from node

    constructor() {
        this.infodata_obj = {
            TYP: "I",
            FWVER: "0.0.0",
            CALL: "",
            ID: "00",
            HWID: 0,
            MAXV: 0,
            BLE: "none",
            BATP: 0,
            BATV: 0,
            "GCB0": 0,
            "GCB1": 0,
            "GCB2": 0,
            "GCB3": 0,
            "GCB4": 0,
            "GCB5": 0,
            "CTRY": "none",
            BOOST: false
        }
        this.own_position = {
            TYP: "G",
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

    addInitChatSegmentMarker(seg:string){
        if(!this.initialChatSegmentMarkers.includes(seg)){
            this.initialChatSegmentMarkers.push(seg);
        }
    }

    clearInitChatSegmentMarkers(){
        this.initialChatSegmentMarkers = [];
    }

    getInitChatSegmentMarkers(){
        return this.initialChatSegmentMarkers;
    }
}

export default new ConfClass();