import { BleClient, numbersToDataView } from "@capacitor-community/bluetooth-le";
import {useMSG} from './MessageHandler';
import { useEffect, useRef, useState } from "react";
import ConfigObject from "../utils/ConfigObject";
import LogS from '../utils/LogService';


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


    // send string message to phone 
    const sendSTRtoNode = (str:string, devID:string) => {
        BleClient.write(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_TXCHAR, numbersToDataView(convSTRtoARR(str))).catch((error) => {
            LogS.log(1,"BLEHANDLER: Error sending STR to Node: " + error);
        });
    }

    // send Dataview to Node
    /*const sendDV = async (buff:DataView, devID:string):Promise<void> => {
        BleClient.write(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_TXCHAR, buff).catch((error) => {
            // reject the promise if there is an error
            LogS.log(1,"BLEHANDLER: Error sending DV to Node: " + error);
            throw new Error("Error sending DV to Node: " + error);
        });
    }*/
    const sendDV = async (buff: DataView, devID: string): Promise<void> => {
        try {
            await BleClient.write(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_TXCHAR, buff);
        } catch (error) {
            LogS.log(1, "BLEHANDLER: Error sending DV to Node: " + error);
            throw error; // Fehler wird weitergegeben
        }
    };
        
    
    // send a text command to node
    const sendTxtCmdNode = (cmd: string) => {
        const ble_devID:string = ConfigObject.getBleDevId();
        console.log("BLEHANDLER - DevID Config Object " + ble_devID);

        if (cmd !== "") {

            let txt_enc = new TextEncoder(); // always utf-8
            const enc_txt_msg = txt_enc.encode(cmd);
            //console.log("UTF-8 CMD Msg: " + enc_txt_msg);

            const txt_len = enc_txt_msg.length;
            const txt_buffer = new ArrayBuffer(txt_len + 2);

            let view1 = new DataView(txt_buffer);
            view1.setUint8(0, txt_len + 2);
            view1.setUint8(1, 0xA0);

            for (let i = 0; i < txt_len; i++)
                view1.setUint8(i + 2, enc_txt_msg[i]);

            console.log("BLEHANDLER: DEVID: " + ble_devID);
            sendDV(view1, ble_devID);

            console.log("Message to Node: " + cmd);

        }
    }

    
    return {

        sendSTRtoNode,
        sendDV,
        sendTxtCmdNode,
        updateDevID,
        updateBLEConnected
    }

}