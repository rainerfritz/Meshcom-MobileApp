import { BleClient, numbersToDataView } from "@capacitor-community/bluetooth-le";
import {useMSG} from './MessageHandler';
import { useEffect, useRef, useState } from "react";
import ConfigObject from "../utils/ConfigObject";


const RAK_BLE_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
//const RAK_BLE_UART_RXCHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const RAK_BLE_UART_TXCHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';


export function useBLE() {


    const {convSTRtoARR} = useMSG();

    const devid_ble = useRef<string>("");

    // BLE connected flag
    const ble_connected = useRef<boolean>(false);
    
    // initial timer to wait after connecting to BLE
    const INIT_CONN_WAIT = 2000;
    // timer for dequeueing messages
    const DEQUEUE_TIMER = 2000;
    // max messages in buffer
    const MAX_MSG_BUFFER = 10;



    // update BLE connected flag
    const updateBLEConnected = (state:boolean) => {

        console.log("BLE Hook BLE Connected: " + state );
        if (state) {
            // wait n seconds after connect before starting message timer
            setTimeout(() => {}, INIT_CONN_WAIT);
            ble_connected.current = state;
        }
        else {
            ble_connected.current = state;
        }
    }

    // update the device ID
    const updateDevID = (devID:string) => {
        devid_ble.current = devID;
        console.log("BLE Hook Device ID: " + devid_ble.current);
    }

    
    // message queue
    const msg_queue = useRef<string[]>([]);
    const dequeue_active = useRef<boolean>(false);
    
    // add message to queue
    const addMsgQueue = (msg:string) => {
        console.log("BLEHANDLER: Adding Message to Queue: " + msg);
        msg_queue.current.push(msg);
        console.log("BLEHANDLER: Message Queue Length adding nr: " + msg_queue.current.length);
        dequeueMsg();

        // remove oldest message if queue is full
        if (msg_queue.current.length >= MAX_MSG_BUFFER)
            msg_queue.current.shift();
    }


    // dequeue messages
    const dequeueMsg = () => {

        console.log("BLEHANDLER: Checking Message Queue");
        console.log("BLEHANDLER: Message Queue Length: " + msg_queue.current.length);

        // send all messages in queue
        if (ble_connected.current && msg_queue.current.length > 0 && !dequeue_active.current) {
            
            while (msg_queue.current.length > 0 && ble_connected.current) { 
                dequeue_active.current = true;
                const msg = msg_queue.current[0];
                console.log("BLEHANDLER: Sending Message: " + msg);
                msg_queue.current.shift();

                sendTxtCmdNode(msg);
                // wait before sending next message
                if (msg_queue.current.length > 0)
                    setTimeout(() => { }, DEQUEUE_TIMER);
            }
            dequeue_active.current = false;
        }
    }


    // send string message to phone 
    const sendSTRtoNode = (str:string, devID:string) => {

        BleClient.write(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_TXCHAR, numbersToDataView(convSTRtoARR(str)));

    }

    // send Dataview to Node
    const sendDV = (buff:DataView, devID:string) => {

        BleClient.write(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_TXCHAR, buff);
    }

    
    // send a text command to node
    const sendTxtCmdNode = (cmd: string) => {
        console.log("BLEHANDLER - DevID Config Object " + ConfigObject.getBleDevId());

        if (cmd !== "") {

            let txt_enc = new TextEncoder(); // always utf-8
            const enc_txt_msg = txt_enc.encode(cmd);
            console.log("UTF-8 CMD Msg: " + enc_txt_msg);

            const txt_len = enc_txt_msg.length;
            const txt_buffer = new ArrayBuffer(txt_len + 2);

            let view1 = new DataView(txt_buffer);
            view1.setUint8(0, txt_len + 2);
            view1.setUint8(1, 0xA0);

            for (let i = 0; i < txt_len; i++)
                view1.setUint8(i + 2, enc_txt_msg[i]);

            console.log("BLEHANDLER: DEVID: " + devid_ble.current);
            sendDV(view1, devid_ble.current);

            console.log("Message to Node: " + cmd);

        }
    }

    
    return {

        sendSTRtoNode,
        sendDV,
        sendTxtCmdNode,
        updateDevID,
        addMsgQueue,
        updateBLEConnected
    }

}