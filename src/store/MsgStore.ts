import {Store} from "pullstate";
//import { MsgType } from "../hooks/UseStorage";

//let msgTypeArr = <MsgType []>[];
let msgTypeArr:MsgType[] = [];

interface MsgType {
    msgNr:number,
    msgTime:string,
    fromCall:string,
    msgTXT:string
}

const MsgStore = new Store({
    msgArr:msgTypeArr
});

export default MsgStore


/**
 * export interface MsgType {
    timestamp:number,
    msgNr:number,
    msgTime:string,
    fromCall:string,
    toCall:string,
    msgTXT:string,
    via:string,
    ack:number,
    isDM:boolean
}
 */