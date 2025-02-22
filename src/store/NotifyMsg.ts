import {Store} from "pullstate";
import { MsgType } from "../utils/AppInterfaces";

const defaultMsg:MsgType = {
    timestamp:0,
    msgNr:0,
    msgTime:"",
    fromCall:"",
    toCall:"",
    msgTXT:"",
    via:"",
    ack:0,
    isDM:0,
    isGrpMsg:0,
    grpNum:0,
    notify:0
}   

const NotifyMsgState = new Store({
    notifyMsg:defaultMsg
})

export default NotifyMsgState