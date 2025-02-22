import {Store} from "pullstate";
import { MsgType } from "../utils/AppInterfaces";

//let msgTypeArr = <MsgType []>[];
let msgTypeArr:MsgType[] = [];

/*interface MsgType {
    msgNr:number,
    msgTime:string,
    fromCall:string,
    msgTXT:string
}*/

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
    isDM:number,
    isGrpMsg:number,
    grpNum:number,
    notify:number
}
 */