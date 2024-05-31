
  /**
 * Messages to and from the phone need to have flag if it is a Text, Pos Msg or it is a configuration
 * Text/Pos flag: 0x40
 * Config Flag: 0x80
 * Mheard Flag: 0x91
 * Data Flag: 0x44 -> GPS Info -> WX-Info -> JSON String starts with:
 * G - GPS
 * W - WX
 * 
 * Config Message Parameters: Callsign, Lat, Lon, altitude
 * Text/Pos Msg Format from Node:
 * LENGTH 1B - FLAG 1B - MSG xB
 * Config Format from Node:
 * LENGTH 1B - FLAG 1B - LENCALL 1B - Callsign - LAT 8B(Double) - LON 8B(Double) - ALT 4B(INT) - 1B SSID_Length - Wifi_SSID - 1B Wifi_PWD - Wifi_PWD 
 * - 1B APRS_PRIM_SEC - 1B APRS_SYMBOL - 4B SettingsMask - 1B HW-ID - 1B MOD-ID - 1B FW-Vers - 1B TX Pwr - 4B Frequency - 1B Comment Length - Comment - 0x00
 * 
 * FW-Vers is deprecated 
 * 
 * Pos APRS Message:
 * 055 ! !00007570 05 OE1KFR-12>*!4823.68N/01631.60E& 100 /A=200 09C0
 * 
 * Text APRS Msg:
 * 022 : !4A157992 85 OE1KFR>*:Test 0493
 * 
 * Dok: https://icssw.org/meshcom-2-0-protokoll/
*/


//import {useStorage, PosType, MsgType, ConfType, MheardType} from './UseStorage';
import ConfigStore from '../store/ConfStore';
import ShouldConfStore from '../store/ShouldConfNode';
import {aprs_char_table, aprs_pri_symbols, aprs_sec_symbols} from '../store/AprsSymbols';
import {hwtable} from '../store/HwTable';
import {modtable} from '../store/ModTable';
import { format, compareAsc, isAfter, fromUnixTime } from "date-fns";
import GpsDataStore from '../store/GpsData';
import WxDataStore from '../store/WxData';
import AprsCmtStore from '../store/AprsCmtStore';
import ScanI2CStore from '../store/ScanI2CStore';
import SensorSettingsStore from '../store/SensorSettings';
import { useRef } from 'react';
import { PosType, MsgType, ConfType, MheardType, SensorSettings, WxData, GpsData, WifiSettings, InfoData, NodeSettings, AprsSettings, Mheard } from '../utils/AppInterfaces';
import ConfigObject from '../utils/ConfigObject';
import DatabaseService from '../DBservices/DataBaseService';
import NodeInfoStore from '../store/NodeInfoStore';
import BleConfigFinish from '../store/BLEConfFin';
import UpdateFW from '../store/UpdtFW';
import WifiSettingsStore from '../store/WifiSettings';
import MheardStaticStore from '../utils/MheardStaticStore';
import NodeSettingsStore from '../store/NodeSettingsStore';
import NotifyMsgState from '../store/NotifyMsg';


export function useMSG() {


    // If you introduce a new message flag, add it to phoncommands.cpp in the sendToPhone() function in the node firmware!

    // Position we store from POS JSON from Node. Needed for mheard distance etc.
    /*const latitude_ref = useRef<number>(0.0);
    const longitude_ref = useRef<number>(0.0);
    const altitude_ref = useRef<number>(0);*/
    const node_call_ref = useRef<string>("");
    const POS_DECIMALS = 4;


    const parseMsg = async (msg:DataView) => {


        // 0x00 at the end of msg indicates msg end!
        const msg_len = msg.byteLength;
        console.log("MSG Len: " + msg_len);
        const msgflag = msg.getUint8(0);
        console.log("MSG Flag: " + msgflag);
        let via_str = " ";

        // get current time and date
        let now_obj = new Date();
        let now_timestamp = now_obj.getTime();
        console.log("Timestamp Now: " + now_timestamp);

        const date_now = format(now_obj, "yyyy-MM-dd");
        let time = format(now_obj, "HH:mm:ss");
        console.log("Date - Time: " + date_now + " - " + time);



        switch (msgflag) {

            case 0x40: {
                // first byte indicates Text or Pos Msg
                // : = Text
                // ! = Pos
                // length 1B - Msg ID 1B - Text
                // 068 : !4A1579EF 85 OE1KFR>*:Hab es schon gefunden. In die Spec schauen hilft ) 1483
                // MsgID from Node after sending TxtMsg: 14 A0 41 70 70 20 2D 3E 20 4E 6F 64 65 20 2D 3E 20 41 70 70

                const msg_type = msg.getUint8(1);
                let call_len = 0;
                const call_offset = 7; // 8th byte 
                const text_offset_call = 4; // 4th byte after callsign ends
                let text_offset = 0;
                let from_callsign_ = "";
                let to_callsign_ = "";
                const msgID = msg.getUint32(2, false);
                console.log("MSGID: " + msgID);
                let route_calls = false;
                let isDM_ = 0;    // flag broadcast or DM message
                let dm_callsign_start = 0;  // start position of DM call in message
                let dm_callsign = "";
                let dm_call_arr: number[] = [];     // buffer for DM callsign
                let timestamp_node = 0;
                
                // if txt or pos msg extract callsign
                let call_arr: number[] = [];

                // if we have a via message with more than one callsign, store it here
                // msg could be: 048 ! x040AA66D 04 0 OE1KFR-2,OE1KFR-1>*!4814.28N/01619.00E# 0 /A=242 0969
                // if we have a * after the > indicates it is a broadcast message, Callsingstring >* is broadcast
                // Direct Message example: 
                // 034 : x00025236 05 0 OE1KFR-4>OE1KFR-2:Test HW:09 MOD:03 FCS:06FD V:0E
                // instead of >* we have >CALLSIGN:

                let route_arr: number[] = [];


                if(msg_type === 58 || msg_type === 33){

                    // from callsign extraction
                    for (let i = 0; i < msg_len; i++) {
                        //stop if > or colon sign comes and store index to call len
                        // ascci 62 = > and ascii 44 = ,

                        
                        if(msg.getUint8(i + call_offset) === 62){

                            call_len = i - 1;
                            break;
                        }

                        if(msg.getUint8(i + call_offset) === 44) {

                            route_calls = true;
                            //console.log("Msg has route info");

                            call_len = i - 1;
                            break;
                        }

                        call_arr[i] = msg.getUint8(i + call_offset);
                        
                    }

                    //console.log("Call Len: " + call_len);
                    from_callsign_ = convBARRtoStr(call_arr);
                    console.log("From Call: " + from_callsign_);

    
                    text_offset = call_offset + text_offset_call + call_len;
                    //console.log("Text Offset: " + text_offset);

                    // if we have colon, we got a via message with additional callsigns as route
                    if(route_calls){
                        //console.log("Getting all callsigns");

                        for (let i = 0; i < msg_len; i++) {

                            if(msg.getUint8(i + call_offset) === 62){

                                call_len = i - 1;
                                text_offset = call_offset + text_offset_call + call_len;
                                //console.log("Text Offset Route: " + text_offset);

                                break;
                            }

                            route_arr[i] = msg.getUint8(i + call_offset);
                        }

                        const route_callstr = convBARRtoStr(route_arr);
                        //console.log("Route Calls str: " + route_callstr);

                        const route_call_arr = route_callstr.split(",");
                        const route_call_cnt = route_call_arr.length;
                        //console.log(route_call_cnt + " Calls in route");

                        // assemble the via string
                        
                        for(let j=0; j<route_call_cnt; j++){

                            if(j < (route_call_cnt - 1)){
                                via_str += route_call_arr[j] + " > ";
                            } else {
                                via_str += route_call_arr[j];
                            }
                        }

                        console.log("Route Calls: " + via_str);

                        // the last 4 bytes are the unix timestamp from node
                        const unix_time = msg.getUint32(msg_len - 5, false) * 1000; // convert to ms
                        console.log("Node Unix Time: " + unix_time);
                        const node_time = format(unix_time, "HH:mm:ss");
                        const node_date = format(unix_time, "yyyy-MM-dd");
                        console.log("Node Date: " + node_date);
                        console.log("Node Time: " + node_time);
                        // we only take the time if it is after 2023-01-01 (node default time is 2023-01-01 00:00:00)
                        if(isAfter(unix_time, new Date(2024,1,1))){
                            timestamp_node = unix_time;
                        }
                    }

                    // get the destination callsign if we have a direct message. After destCallsign we have a : stop there
                    // check if it is broadcast or DM

                    if(msg.getUint8(text_offset - 2) === 42){

                        isDM_ = 0;
                        console.log("Broadcast Message received");
                        
                    } else {

                        isDM_ = 1;
                        dm_callsign_start = text_offset - 2;
                        console.log("Direct Message received");

                    }

                    if(isDM_ === 1){

                        let dm_arr_index = 0;
                        for (let i = dm_callsign_start; i < msg_len; i++){

                            if(msg.getUint8(i) === 0x3a){
                                // set start of message text accordingly
                                text_offset = i + 1;
                                break;
                            }

                            dm_call_arr[dm_arr_index] = msg.getUint8(i);
                            dm_arr_index++;
                        }

                        dm_callsign = convBARRtoStr(dm_call_arr);

                        // save it as tocall in the message obj to show to call info in chat bubble
                        to_callsign_ = dm_callsign;

                        console.log("DM Dest. Callsign: " + dm_callsign);

                    }
                }


                // Textmessage
                if (msg_type === 58) {

                    console.log("Text Msg received");

                    // check if it needs to notify. new connect buffer gets sent from node and we dont't want to notify for them
                    // byte index 5 indicates that
                    // byte 5 mit 0x20 maskieren
                    // wenn 1 kein notify
                    // wenn 0 notify

                    let notify_ = 1;

                    if((msg.getUint8(6) & 0x20) !== 0){

                        notify_ = 0;
                        console.log("Message wants notify");

                    } 

                    //get text
                    let txt_arr: number[] = [];

                    
                    for (let i = 0; i < msg_len; i++) {
                        //read till 0x00 byte in APRS msg
                        if (msg.getUint8(i + text_offset) === 0) break;
                        txt_arr[i] = msg.getUint8(i + text_offset);
                    }

                    let msg_text_ = convBARRtoStr(txt_arr);
                    
                    console.log("Msg Text: " + msg_text_);

                    // ignore the timestamp messages
                    if(msg_text_.startsWith("{CET}")){
                        console.log("Discarding Timestamp Message from Lora Network Server!");
                        return
                    }

                    // Battery values
                    let bat_volt_ = 0.0;
                    let bat_perc_ = 0.0;

                    // if a message starts with -- we got a command ack from node which was triggered by a textcommand or serial command
                    if(msg_text_.startsWith("--")){

                        console.log("CMD Ack received: " + msg_text_);

                        // split up to cmd and value
                        const cmd_str_arr:string [] = msg_text_.split(" "); 

                        // commands from phone we don't show in chat
                        let show_msg = true;

                        switch (cmd_str_arr[0]){

                            case "--gateway": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.gw_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.gw_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--bme": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.bme_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.bme_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--bmp": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.bmp_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.bmp_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--bmx": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.bmp_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.bmp_on = false});
                                    ConfigStore.update(s => {s.config.bme_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--gps": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.gps_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.gps_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--display": {
                                if(cmd_str_arr[1] === "off"){
                                    ConfigStore.update(s => {s.config.display_off = true});
                                } else {
                                    ConfigStore.update(s => {s.config.display_off = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--button": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.button_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.button_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--track": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.track_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.track_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--BAT": {
                                console.log("BAT Info received");
                                // —BAT 9.99 999 first value voltag, second percentage

                                bat_volt_ = +cmd_str_arr[1];
                                bat_perc_ = +cmd_str_arr[2];
                                console.log("BAT Volt: " + bat_volt_);
                                console.log("BAT: " + bat_perc_ + "%");

                                // update config
                                ConfigStore.update(s => {
                                    s.config.bat_volt = bat_volt_;
                                    s.config.bat_perc = bat_perc_;
                                });


                                show_msg = false;
                                break;
                            }

                            case "--txpower": {
                                let tx_pwr_ = +cmd_str_arr[1];

                                if(tx_pwr_ >= 1 && tx_pwr_ <= 30){
                                    ConfigStore.update(s => {s.config.tx_pwr = tx_pwr_});
                                } else {
                                    console.log("Wrong TX-Pwr Value!");
                                }

                                show_msg = false;
                                break;
                            }

                            case "--atxt": {
                                let aprs_cmt = cmd_str_arr[1];
                                console.log("-Mhandler APRS Comment: " + aprs_cmt);

                                if(aprs_cmt !== "none" && aprs_cmt.length > 0){
                                    AprsCmtStore.update(s => {s.aprsCmt = aprs_cmt});
                                }

                                show_msg = false;
                                break;
                            }

                            case "--onewire": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.onewire_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.onewire_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--lps33": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.lps33_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.lps33_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--mesh": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.mesh_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.mesh_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--680": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.bme680_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.bme680_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--811": {
                                if(cmd_str_arr[1] === "on"){
                                    ConfigStore.update(s => {s.config.mcu811_on = true});
                                } else {
                                    ConfigStore.update(s => {s.config.mcu811_on = false});
                                } 
                                show_msg = false;
                                break;
                            }

                            case "--utcoff": {
                                let utcoff_ = +cmd_str_arr[1];
                                console.log("UTC Offset: " + utcoff_);
                                if(utcoff_ >= -15 && utcoff_ <= 30){
                                    ConfigStore.update(s => {s.config.node_utc_offset = utcoff_});
                                } else {
                                    console.log("Wrong UTC Offset Value!");
                                }

                                show_msg = false;
                                break;
                            }

                            case "--[I2C]": {
                                console.log("I2C Info received");
                                let scan_info = msg_text_.replace("--[I2C] ... Scanner\n", "");
                                scan_info += "\n" + time;
                                console.log("Scan Info: " + scan_info);
                                // update ScanI2CStore
                                ScanI2CStore.update(s => {s.scanresult = scan_info});

                                show_msg = false;
                                break;
                            }

                            default: console.log("CMD Message Ack not known!");
                        }
                        if(!show_msg) return;
                    }

                    // if the message is a DM remove {number at end
                    if(msg_text_.includes("{")){
                        const signindex = msg_text_.indexOf("{");
                        const slicedTxt = msg_text_.slice(0, signindex);
                        msg_text_ = slicedTxt;
                    }

                    // set the time if it is a valid time
                    if(timestamp_node !== 0){
                        now_timestamp = timestamp_node;
                        time = format(timestamp_node, "HH:mm:ss");
                    }

                    // add it to DB
                    if(from_callsign_ !== "response"){

                        const newMsgDB: MsgType = {
                            timestamp:now_timestamp,
                            msgNr:msgID,
                            msgTime:time,
                            fromCall: from_callsign_,
                            toCall: to_callsign_,
                            msgTXT: msg_text_,
                            via: via_str,
                            ack:0,
                            isDM: isDM_,
                            notify:notify_
                        }

                        return (newMsgDB);
                    }
                }

                // Posmessage
                if (msg_type === 33){

                    console.log("Pos Msg received");

                    // ! xAE48D54D 05 1 0 9V1LH-1,OE1KBC-12>*!0122.64N/10356.52E#/B=005/A=000161/P=1004.9/H=40.2/T=28.9/Q=1005.4 HW:04 MOD:03 FCS:15D5 FW:17 LH:09
                    // Postext: 4711.55N/01444.60E_MeshCom Zeltweg /B=089/A=002451  -> Message with a comment

                    
                    //get text
                    let pos_arr:number[] = [];

                    //hardware string of node
                    let hw_str:string = "";

                    // last 2x4 bytes are checksum
                    for(let i=0; i< (msg_len); i++){

                        if((msg.getUint8(i + text_offset)) === 0) {
                            //get HW ID
                            const hw_id =  msg.getUint8(i + text_offset + 1);
                            //console.log("HW ID: " + hw_id);
                            hw_str = hwtable[hw_id];
                            console.log("HW String: " + hw_str);

                            break;
                        }

                        pos_arr[i] = msg.getUint8(i + text_offset);
                        
                    }

                    const pos_text_ = convBARRtoStr(pos_arr);
                    console.log("Postext: " + pos_text_);



                    // lat hat nur 4 stellen vor dem . bis 90 grad = ersten zwei Stellen deg
                    // lon 5 stellen vor dem  . = ersten drei Stellen deg weil bis 180 grad beides mit leading zeros

                    // APRS Format has a fixed length, get lat lon from MsgTxT Ex: 4814.23N/01618.97Eu

                    const lat_lon_str = pos_text_.slice(0, 19);
                    console.log("Lat/Lon String: " + lat_lon_str);

                    // get W/E info and multiply longitude by -1 if W
                    const long_dir = lat_lon_str.slice(17, 18);
                    console.log("E/W Long Direction: " + long_dir);

                    // get N/S info and multiply latitude by -1 if S
                    const lat_dir = lat_lon_str.slice(7, 8);
                    console.log("N/S Lat Direction: " + lat_dir);

                    // get the rest of the string if there are telemetry data and comments
                    // 4711.55N/01444.60E_MeshCom Zeltweg /B=089/A=002451 
                    // 4814.23N/01618.97Eu/B=100/A=000787

                    let telemetry_str = "";
                    let str_split:string [] = [];
                    let aprs_cmt = "";

                    if (pos_text_.length > 19) {
                        telemetry_str = pos_text_.slice(20, pos_text_.length);
                        console.log("Telemetry String: " + telemetry_str);
                        str_split = telemetry_str.split("/");

                        // check if we have a comment and extract it
                        if (pos_text_.charAt(19) !== '/' && pos_text_.charAt(19) !== ' ') {

                            let char_index = 19

                            for(let i=char_index; i<pos_text_.length; i++){
                                if(pos_text_.charAt(i) === '/'){
                                    char_index = i;
                                    break;
                                } else {
                                    char_index = i;
                                }
                            }

                            aprs_cmt = pos_text_.slice(19,char_index);
                            console.log("APRS Comment: " + aprs_cmt);
                        }
                    }

                    // Process LAT / LON and convert to Degree with Decimals

                    const splitSign = lat_lon_str.charAt(8);
                    //console.log("Splitsign: " + splitSign);
                    const latlon_arr = lat_lon_str.split(splitSign);
                    
                    let latitude = latlon_arr[0];
                    //console.log("Lat Str: " + latitude);
                    
                    // separate degree, minutes and decimals of minutes
                    // remove N/S from Lat at the end of str
                    latitude = latitude.slice(0, latitude.length - 1);

                    const lat_substr = latitude.split(".");
                    const lat_substr_deg_len = lat_substr[0].length;
                    //console.log("Lat Substr Len: " + lat_substr_deg_len);

                    const lat_deg = lat_substr[0].slice(0,lat_substr_deg_len -2);
                    //console.log("Lat Deg: " + lat_deg);

                    const lat_min = lat_substr[0].slice(lat_substr_deg_len - 2,lat_substr_deg_len);
                    //console.log("Lat Min: " + lat_min);

                    const lat_min_dec = lat_substr[1].slice(0,lat_substr[1].length);
                    //console.log("Lat Min Dec: " + lat_min_dec);

                    // rearrange to min with decimals
                    const minute_str = lat_min + "." + lat_min_dec;
                    
                    let minute_nr = +minute_str;
                    
                    // calculate degree with decimals
                    minute_nr = minute_nr / 60;
                    //console.log("Lat Minute Nr: " + minute_nr);
                    let lat_degree_final = +lat_deg + minute_nr;

                    // assemble longitude and calculate. Longitude
                    let longitude = latlon_arr[1];
                    // has fixed length
                    longitude = longitude.slice(0, 8);
                    //console.log("Longitude String: " + longitude);


                    // separate degree, minutes and decimals of minutes
                    const lon_substr = longitude.split(".");
                    const lon_substr_deg_len = lon_substr[0].length;

                    const lon_deg = lon_substr[0].slice(0,lon_substr_deg_len -2);

                    //console.log("Lon Deg: " + lon_deg);

                    const lon_min = lon_substr[0].slice(lon_substr_deg_len - 2,lon_substr_deg_len);
                    //console.log("Lon Min: " + lon_min);

                    const lon_min_dec = lon_substr[1].slice(0,lon_substr[1].length);
                    //console.log("Lon Min Dec: " + lon_min_dec);

                    // rearrange to min with decimals
                    const lon_minute_str = lon_min + "." + lon_min_dec;
                    //console.log("Lon Minute Str: " + lon_minute_str);
                    let lon_minute_nr = +lon_minute_str;
                    // calculate degree with decimals
                    lon_minute_nr = lon_minute_nr / 60;
                    //console.log("Lon Minute Nr: " + lon_minute_nr);
                    let lon_degree_final = +lon_deg + lon_minute_nr;

                    // assign correct sign if W/E direction
                    if(long_dir === "W"){
                        lon_degree_final = lon_degree_final * -1.0;
                    }
                    // assign correct sign if S/N direction
                    if(lat_dir === "S"){
                        lat_degree_final = lat_degree_final * -1.0;
                    }


                    // round to 5 decimals
                    lat_degree_final = Math.round(lat_degree_final * 10000) / 10000;
                    lon_degree_final = Math.round(lon_degree_final * 10000) / 10000;

                    // avoid 0.0 / 0.0 POS
                    if(lat_degree_final === 0.0 && lon_degree_final === 0.0) break;
                    

                    console.log("Pos Msg Latitude: " + lat_degree_final);
                    console.log("Pos Msg Longitude: " + lon_degree_final);

                    //check which additional info we got. 
                    let alt_string = "0";
                    let bat_str = "0";
                    let alt_nr_meter = 0;   // 0 is a valid value !! TODO change that!
                    let pressure_ = 0;
                    let humidity_ = 0;
                    let temperature_ = 999; // 0 would be a valid value!
                    let qnh_ = 0;
                    let temp_out_ = 999;
                    let gas_res_ = 0;
                    let co2_ = 0;
                    let data_vers_ = 0;
                    let alt_press_ = 0;  // currently F indicator is altitude from pressure but should be QFE, which is not ready implemented!
                    //let qfe_ = 0;

                    // NEW-POS: 099 ! xA4ED0019 05 0 1 OE1KFR-2>*!4814.35N/01619.05E#/A=000804/P=984.3/H=48.0/T=20.7/O=20.8/F=243/G=36.3/V=3 HW:10 MOD:03 FCS:146D FW:1D LH:0A
                    
                    if(str_split.length >= 1){

                        console.log("Telemetry Data received!");

                        //check what field has which info
                        for(let i=0; i<str_split.length; i++){

                            const fieldinfo = str_split[i].slice(0,2);
                            console.log("Field Info: " + fieldinfo);
                            const value_str = str_split[i].slice(2);
                            console.log("Value: " + value_str);

                            switch (fieldinfo){

                                case "A=": {
                                    alt_nr_meter = convertAlt(value_str);
                                    console.log("Altitude: " + alt_nr_meter);
                                    break;
                                }
                                case "B=": {
                                    // remove leading zeros
                                    bat_str = value_str;
                                    if (bat_str.startsWith("0")) {
                                        bat_str = bat_str.slice(1);
                                    }
                                    if (bat_str.startsWith("0")) {
                                        bat_str = bat_str.slice(1);
                                    }
                                    console.log("Battery: " + bat_str);
                                    break;
                                }
                                case "P=": {

                                    pressure_ = +value_str;
                                    console.log("Pressure: " + pressure_);
                                    break;
                                }
                                case "H=": {

                                    humidity_ = +value_str;
                                    console.log("Humidity: " + humidity_);
                                    break;
                                }
                                case "T=": {

                                    temperature_ = +value_str;
                                    console.log("Temperature: " + temperature_);
                                    break;
                                }
                                case "Q=": {

                                    qnh_ = +value_str;
                                    console.log("QNH: " + qnh_);
                                    break;
                                }
                                case "O=": {

                                    temp_out_ = +value_str;
                                    console.log("Temp Out: " + temp_out_);
                                    break;
                                }
                                case "G=": {

                                    gas_res_ = +value_str;
                                    console.log("Gas Resistance: " + gas_res_);
                                    break;
                                }
                                case "V=": {

                                    data_vers_ = +value_str;
                                    console.log("Data Version: " + data_vers_);
                                    break;
                                }
                                case "C=": {

                                    co2_ = +value_str;
                                    console.log("CO2: " + co2_);
                                    break;
                                }
                                case "F=": {

                                    alt_press_ = +value_str;
                                    console.log("Alt Press: " + alt_press_);
                                    break;
                                }
                                
                            }
                        }

                        if (bat_str === "0") bat_str = "N.A.";

                        //console.log("Pos Msg Battery: " + bat_str);

                    }
                    
                    // check for valid lat lon value
                    if (lat_degree_final !== 0.0 && lon_degree_final !== 0.0) {

                        //add update pos in DB
                        const newPosDB: PosType = {
                            timestamp:now_timestamp,
                            callSign: from_callsign_,
                            lat: lat_degree_final,
                            lon: lon_degree_final,
                            alt: alt_nr_meter,
                            bat: bat_str,
                            hw: hw_str,
                            pressure: pressure_,
                            temperature: temperature_,
                            humidity: humidity_,
                            qnh: qnh_,
                            comment: aprs_cmt,
                            temp_2: temp_out_,
                            gas_res: gas_res_,
                            co2: co2_,
                            alt_press: alt_press_
                        }

                        return (newPosDB);

                    } else {
                        console.log("Discarding Pos Msg! Lat or Long not provided.")
                    }
                }

                // acknowledge from node for txtmsg - sends back msgID
                // we have two ack states. 1 -> ack from node | 2 -> ack from gateway
                if (msg_type === 0x41){
                    console.log("Txt Msg Acknowledge from node");

                    const ack_state = msg.getUint8(6);
                    console.log("Ack State: " + ack_state);
                    
                    // Handle Acknowledge of Text Msg
                    DatabaseService.ackTxtMsg(msgID, ack_state);
                }

                break;
            }

            case 0x80: {

                console.log("Config Msg received");

                /*
                LENGTH 2B - FLAG 1B - LENCALL 1B - Callsign - LAT 8B(Double) - LON 8B(Double) - ALT 4B(INT) - 1B SSID_Length - Wifi_SSID - 1B Wifi_PWD - Wifi_PWD 
                - 1B APRS_PRIM_SEC - 1B APRS_SYMBOL - 4B SettingsMask - 1B HW-ID - 1B MOD-ID - 1B FW_Version - 1B Comment Length - Comment - 4B Settingsbyte2 - 0x00
                */

                const call_offset_conf = 2;
                const call_len_conf = msg.getUint8(1);
                let call_arr_conf:number[] = [];
                const lat_offset = call_offset_conf + call_len_conf;
                const lon_offset = lat_offset + 8;
                const alt_offset = lon_offset + 8;
                let aprs_sym_offset = 0;

                // read only wifi settings if we get some from node. 
                
                let ssid_node:string = " ";
                let wifi_pwd_node:string = " ";

                if (msg_len > (alt_offset + 5)) {

                    let ssid_len = 0;
                    let ssid_offset = 0;
                    let wifi_pwd_offset = 0;
                    let wifi_pwd_len = 0;
                    let real_ssid_len = 0;
                    let real_wifi_pwd_len = 0;
                    

                    ssid_offset = alt_offset + 4;
                    ssid_len = msg.getUint8(ssid_offset);
                    wifi_pwd_offset = ssid_offset + ssid_len + 1;
                    wifi_pwd_len = msg.getUint8(wifi_pwd_offset);
                    aprs_sym_offset = wifi_pwd_offset + wifi_pwd_len + 1;

                    console.log("SSID Len: " + ssid_len);
                    console.log("PWD Len: " + wifi_pwd_len);

                    let ssid_arr_conf: number[] = [];
                    let wifi_pwd_arr_conf: number[] = [];

                    // read until trailing zeros coming. all buffers from node 
                    // are fixed length and filled with zeros if string is shorter
                    for (let i = 0; i < ssid_len; i++) {

                        if ((msg.getUint8(i + ssid_offset + 1)) === 0) break;
                        ssid_arr_conf[i] = msg.getUint8(i + ssid_offset + 1); // first byte is length
                        real_ssid_len++;
                    }

                    for (let i = 0; i < wifi_pwd_len; i++) {

                        if ((msg.getUint8(i + wifi_pwd_offset + 1)) === 0) break;
                        wifi_pwd_arr_conf[i] = msg.getUint8(i + wifi_pwd_offset + 1); // first byte is length
                        real_wifi_pwd_len++;
                    }

                    //console.log("SSID Len real: " + real_ssid_len);
                    //console.log("Wifi PWD real Len: " + real_wifi_pwd_len);

                    ssid_node = convBARRtoStr(ssid_arr_conf);
                    wifi_pwd_node = convBARRtoStr(wifi_pwd_arr_conf);

                    console.log("Wifi SSID from Node: " + ssid_node);
                    //console.log("Wifi PWD from Node: " + wifi_pwd_node);

                }
                

                // node sends call in fixed buff length filled with zeros
                let real_call_len = 0;
                
                // get callsign from node
                for(let i=0; i<call_len_conf; i++){
                    if((msg.getUint8(i + call_offset_conf)) === 0) break;
                    call_arr_conf[i] = msg.getUint8(i + call_offset_conf);
                    real_call_len = i;
                }
                

                const callsign_node:string = convBARRtoStr(call_arr_conf);
                // store current connected node callsign
                
                console.log("Node Callsign: " + callsign_node);

                // get Latitude from node (float 4 bytes)
                let lat_from_node = msg.getFloat64(lat_offset, true);
                lat_from_node = Math.round(lat_from_node * 10000) / 10000;
                console.log("Latitude from Node: " + lat_from_node.toFixed(POS_DECIMALS));

                // get longitude from node
                let lon_from_node = msg.getFloat64(lon_offset, true);
                lon_from_node = Math.round(lon_from_node * 10000) / 10000;
                console.log("Longitude from Node: " + lon_from_node.toFixed(POS_DECIMALS));

                // get altitude from node
                const alt_from_node = msg.getInt32(alt_offset, true);
                console.log("Altitude from Node: " + alt_from_node);

                // get aprs symbols - currently the last two bytes of the config message
                let aprs_pri_sec_ = " ";
                let aprs_symbol_ = " ";
                let aprs_symbol_name_ = "";

                if (msg.getUint8(aprs_sym_offset) !== 0 && msg.getUint8(aprs_sym_offset + 1) !== 0){

                    aprs_pri_sec_ = String.fromCharCode(msg.getUint8(aprs_sym_offset)); 
                    aprs_symbol_ = String.fromCharCode(msg.getUint8(aprs_sym_offset + 1)); 
                    console.log("APRS prim/sec symbol: " + aprs_pri_sec_);
                    console.log("APRS symbol Char: " + aprs_symbol_);

                    //get aprs symbol name
                    if(aprs_pri_sec_ === "/"){
                        aprs_pri_symbols.forEach(element => {
                            if(element.s_char.includes(aprs_symbol_)){
                                console.log("APRS Sym Name: " + element.s_name);
                                aprs_symbol_name_ = element.s_name
                            }
                        });
                    } else {
                        aprs_sec_symbols.forEach(element => {
                            if(element.s_char.includes(aprs_symbol_)){
                                console.log("APRS Sym Name: " + element.s_name);
                                aprs_symbol_name_ = element.s_name
                            }
                        });
                    }

                }

                // get the settings bytes 4B length
                const offSetSettingsBytes = aprs_sym_offset + 2;
                const settingBytes = msg.getInt32(offSetSettingsBytes, true);
                console.log("Settings Byte Value: " + settingBytes);

                /*
                bDisplayVolt = meshcom_settings.node_sset & 0x0001;
                bDisplayOff = meshcom_settings.node_sset & 0x0002;
                bPosDisplay = meshcom_settings.node_sset & 0x0004;
                bDEBUG = meshcom_settings.node_sset & 0x0008;
                bButtonCheck = meshcom_settings.node_sset & 0x0010;
                bDisplayTrack = meshcom_settings.node_sset & 0x0020;
                bGPSON =  meshcom_settings.node_sset & 0x0040;
                bBMPON =  meshcom_settings.node_sset & 0x0080;
                bBMEON =  meshcom_settings.node_sset & 0x0100;
                bLORADEBUG = meshcom_settings.node_sset & 0x0200;
                bSHORTPATH = meshcom_settings.node_sset & 0x0400;
                bGATEWAY =  meshcom_settings.node_sset & 0x1000;
                bEXTUDP =  meshcom_settings.node_sset & 0x2000;
                bEXTSER =  meshcom_settings.node_sset & 0x4000;

                bONEWIRE =  meshcom_settings.node_sset2 & 0x0001;
                bLPS33 =  meshcom_settings.node_sset2 & 0x0002;
                MESH = meshcom_settings.node_sset2 & 0x0020;
                bBME680ON =  meshcom_settings.node_sset2 & 0x0004;
                bMCU811ON =  meshcom_settings.node_sset2 & 0x0008;
                */
                const opt_bDisplayVolt = 0x0001;
                const opt_bDisplayOff = 0x0002;
                const opt_bPosDisplay = 0x0004;
                const opt_Button = 0x0010;
                const opt_bGPSON = 0x0040;
                const opt_bBMPON = 0x0080;
                const opt_bBMEON = 0x0100;
                const opt_bGATEWAY = 0x1000;
                const opt_TrackOn = 0x0020;

                let gps_on_ = false;
                let bmp_on_ = false;
                let bme_on_ = false;
                let gw_on_ = false;
                let button_on_ = false;
                let display_off_ = false;
                let track_on_ = false;

                console.log("GW Option: " + (settingBytes & opt_bGATEWAY));
                console.log("GPS Option: " + (settingBytes & opt_bGPSON));
                console.log("BMP Option: " + (settingBytes & opt_bBMPON));
                console.log("BME Option: " + (settingBytes & opt_bBMEON));
                console.log("Button On Option: " + (settingBytes & opt_Button));
                //console.log("Button OFF Option: " + (settingBytes & opt_ButtonOff));
                console.log("Display Off Option: " + (settingBytes & opt_bDisplayOff));
                console.log("Tracking On Option: " + (settingBytes & opt_TrackOn));
                //console.log("Tracking Off Option: " + (settingBytes & opt_TrackOff));


                // uncomment after testing new jsons
                /*if((settingBytes & opt_bGATEWAY) !== 0) gw_on_ = true;
                if((settingBytes & opt_bGPSON) !== 0) gps_on_ = true;
                if((settingBytes & opt_bBMPON) !== 0) bmp_on_ = true;
                if((settingBytes & opt_bBMEON) !== 0) bme_on_ = true;
                if((settingBytes & opt_Button) !== 0) button_on_ = true;
                if((settingBytes & opt_bDisplayOff) !== 0) display_off_ = true;
                if((settingBytes & opt_TrackOn) !== 0) track_on_ = true;*/


                // get HW-Type, Modulation ID, FW Version, QRG
                let fw_vers_str_ = "";
                let hw_str = "";
                let mod_str_ = "";
                let tx_pwr_ = 0;
                let frequency_ = 0;

                const offSetHwModFWvers = offSetSettingsBytes + 4;

                if (msg.getUint8(offSetHwModFWvers)) {
                    
                    const hw_type_ = msg.getUint8(offSetHwModFWvers);
                    const mod_id_ = msg.getUint8(offSetHwModFWvers + 1);
                    const fw_vers_ = msg.getUint8(offSetHwModFWvers + 2);
                    // show firmware update alert for versions older than 4.30
                    if (fw_vers_ < 30) {
                        console.log("MHandler: Firmware Update Alert!");
                        UpdateFW.update(s => {s.updatefw = true});
                    }
                    tx_pwr_ = msg.getInt8(offSetHwModFWvers + 3);
                    frequency_ = msg.getFloat32(offSetHwModFWvers + 4, true);
                    frequency_ = Math.round(frequency_ * 10000) / 10000;
                    fw_vers_str_ = "4." + fw_vers_.toString();
                    hw_str = hwtable[hw_type_];
                    mod_str_ = modtable[mod_id_];
                }

                console.log("HW Type: " + hw_str);
                console.log("Modulation ID: " + mod_str_);
                console.log("FW Version: " + fw_vers_str_);
                console.log("TX Power: " + tx_pwr_);
                console.log("Frequency: " + frequency_);

                // check if after the frequency we have a comment, first byte is length
                let comment_str = "";

                let comment_offset = offSetHwModFWvers + 8;
                console.log("Comment Offset: " + comment_offset);
                let comment_len = 0;

                // get the second settings bytes 4B length
                let onewire_on_ = false;
                let lps33_on_ = false;
                let mesh_retrx_ = true;
                let bme680_on_ = false;
                let mcu811_on_ = false;


                if(msg_len > comment_offset){

                    console.log("Checking Comment and 2nd Settings Byte");
                    console.log("Value at Comment Offset: " + msg.getUint8(comment_offset));

                    if (msg.getUint8(comment_offset) && msg.getUint8(comment_offset) !== 0x00) {
                        

                        comment_len = msg.getUint8(comment_offset);
                        console.log("Comment Length: " + comment_len);
    
                        if (comment_len > 0) {
    
                            // create array for comment string and read it, use length from first byte
                            let comment_arr: number[] = [];
                            // read the bytes until we reach a 0x00 or the length of the comment
                            for (let i = 0; i < comment_len; i++) {
                                if ((msg.getUint8(i + comment_offset + 1)) === 0) break;
                                comment_arr[i] = msg.getUint8(i + comment_offset + 1); // first byte is length
                            }
                            // convert array to string
                            comment_str = convBARRtoStr(comment_arr);
                        }
                        
                        console.log("Comment: " + comment_str);
                    }

                    
                }

                if(msg_len >= (comment_offset + comment_len + 5)){

                    // check if we have a second settings byte
                        console.log("Value at Comment Offset + Comment Len + 1: " + msg.getUint8(comment_offset + comment_len + 1));

                        const offSetSettings2Bytes = comment_offset + comment_len + 1;
                        const setting2Bytes = msg.getInt32(offSetSettings2Bytes, true);
                        console.log("Settings 2 Byte Value: " + settingBytes);
    
                        /*
                        bONEWIRE =  meshcom_settings.node_sset2 & 0x0001;
                        bLPS33 =  meshcom_settings.node_sset2 & 0x0002;
                        MESH = meshcom_settings.node_sset2 & 0x0020;
                        bBME680ON =  meshcom_settings.node_sset2 & 0x0004;
                        bMCU811ON =  meshcom_settings.node_sset2 & 0x0008;
                        */
    
                        const opt_bONEWIRE = 0x0001;
                        const opt_bLPS33 = 0x0002;
                        const opt_bMESH = 0x0020;
                        const opt_bBME680ON = 0x0004;
                        const opt_bMCU811ON = 0x0008;
    
                        console.log("OneWire Option: " + (setting2Bytes & opt_bONEWIRE));
                        console.log("LPS33 Option: " + (setting2Bytes & opt_bLPS33));
                        console.log("MESH Option: " + (setting2Bytes & opt_bMESH));
                        console.log("BME680 Option: " + (setting2Bytes & opt_bBME680ON));
                        console.log("MCU811 Option: " + (setting2Bytes & opt_bMCU811ON));
    
                        /*if ((setting2Bytes & opt_bONEWIRE) !== 0) onewire_on_ = true;
                        if ((setting2Bytes & opt_bLPS33) !== 0) lps33_on_ = true;
                        if ((setting2Bytes & opt_bMESH) !== 0) mesh_retrx_ = false;
                        if ((setting2Bytes & opt_bBME680ON) !== 0) bme680_on_ = true;
                        if ((setting2Bytes & opt_bMCU811ON) !== 0) mcu811_on_ = true;*/
    
                }
                

                console.log("Setting Config Object");

                let newConfig: ConfType = {
                    callSign: callsign_node,
                    lat: lat_from_node,
                    lon: lon_from_node,
                    alt: alt_from_node,
                    wifi_ssid: ssid_node,
                    wifi_pwd: wifi_pwd_node,
                    aprs_pri_sec: aprs_pri_sec_,
                    aprs_symbol: aprs_symbol_name_,
                    gps_on: gps_on_,
                    bme_on: bme_on_,
                    bmp_on: bmp_on_,
                    gw_on: gw_on_,
                    display_off: display_off_,
                    track_on: track_on_,
                    button_on: button_on_,
                    bat_perc: 0.0,
                    bat_volt: 0.0,
                    hw: hw_str,
                    mod: mod_str_,
                    fw_ver: fw_vers_str_,
                    tx_pwr:tx_pwr_,
                    frequency:frequency_,
                    comment: comment_str,
                    onewire_on: onewire_on_,
                    lps33_on: lps33_on_,
                    onewire_pin: 0,
                    mesh_on: mesh_retrx_,
                    bme680_on: bme680_on_,
                    mcu811_on: mcu811_on_,
                    node_utc_offset: 0,
                }

                // update config in store state
                console.log("Update Config in Store");
                /*ConfigStore.update(s => {
                    s.config = newConfig;
                });*/

                // update AprsComment in store state
                AprsCmtStore.update(s => {
                    s.aprsCmt = comment_str;
                });


                // show set baseconfig alert on unset node
                if(newConfig.callSign === "" || newConfig.callSign === "XX0XXX-00"){

                    /*ShouldConfStore.update(s => {
                        s.shouldConf = true;
                    });*/

                } 

                break;
            }

            case 0x91: {

                /**
                 * länge 1B- 0x91 - 10B Call (0x00 term.) - Datum - Zeit - Type (:/!/) - HW Type from Call - MOD (3 medium slow) - RSSI - SNR @
                 * Trennzeichen @
                 */

                /*console.log("Mheard Msg received");

                let callsign_arr:number[] = [];
                let date_arr:number[] = [];
                let time_arr:number[] = [];
                let rssi_arr:number[] = [];
                let snr_arr:number[] = [];
                let hw_arr:number[] = [];
                
                let msg_type = ':';
                let hw_type = 0;
                let modulation = 0;
                let rssi = 0;
                let call_str = "";
                let call_end_index = 0;
                let date_str = "";
                let time_str = "";
                let snr = 0;


                // get callsign - field has currently fixed 10 length filled with 0x00
                for (let i=1; i<msg_len; i++){

                    if(msg.getUint8(i) === 0x00) {
                        if(call_end_index < 10) call_end_index = 10;
                        break;
                    }
                    callsign_arr[i-1] = msg.getUint8(i);
                    call_end_index = i;
                }

                call_str = convBARRtoStr(callsign_arr);
                console.log("Call: " + call_str);

                let index = 0;
                let field = 1; // 1:Datum, 2:Zeit, 3:MSGType, 4:HW, 5: Modulation, 6:RSSI, 7:SNR

                for (let i=call_end_index + 1; i<msg_len; i++){

                    if(msg.getUint8(i) === 0x00) break;
                    //console.log("Field: " + field);
                    //console.log("i: " + i);

                    if(msg.getUint8(i) === 0x40){
                        // @ split sign reached
                        field++;
                        index = 0;
                        i++;
                    }


                    switch (field){

                        case 1: {
                            date_arr[index] = msg.getUint8(i);
                            break;
                        }
                        case 2: {
                            time_arr[index] = msg.getUint8(i);
                            break;
                        }
                        case 3: {
                            msg_type = String.fromCharCode(msg.getUint8(i));
                            break;
                        }
                        case 4: {
                            hw_arr[index] = msg.getUint8(i);
                            break;
                        }
                        case 5: {
                            modulation = +String.fromCharCode(msg.getUint8(i));
                            break;
                        }
                        case 6: {
                            rssi_arr[index] = msg.getUint8(i);
                            break;
                        }
                        case 7: {
                            snr_arr[index] = msg.getUint8(i);
                            break;
                        }
                    }
                    
                    index++;

                }

                date_str = convBARRtoStr(date_arr);
                // if date = 2023-01-01 (default on node fw) the node had no actual time add current date and time
                if(date_str === "2023-01-01"){
                    date_str = date_now;
                }
                console.log("Date: " + date_str);

                time_str = convBARRtoStr(time_arr);
                if(date_str === "2023-01-01"){
                    time_str = time;
                }
                console.log("Time: " + time_str);

                console.log("Msg Type: " + msg_type);
                hw_type = +convBARRtoStr(hw_arr);

                console.log("HW ID: " + hw_type);
                console.log("MOD: " + modulation);

                rssi = +convBARRtoStr(rssi_arr);
                console.log("RSSI: " + rssi);
                
                snr = +convBARRtoStr(snr_arr);
                console.log("SNR: " + snr);

                const hw_str = hwtable[hw_type];
                console.log("HW String: " + hw_str);

                // check if we have a position to this callsign to calc distance as the crow flies (in km)
                let distance = 0;

                // we add own nodecall when writing to DB
                let newMheard:MheardType = {
                    mh_timestamp:now_timestamp,
                    mh_nodecall:"",
                    mh_callSign:call_str,
                    mh_date:date_str,
                    mh_time:time_str,
                    mh_rssi:rssi,
                    mh_snr:snr,
                    mh_hw:hw_str,
                    mh_distance:distance
                }

                return (newMheard);*/
            }

            // Data Message from Node
            /**
             * GPS Data
             * DG{"TYP":"G","LAT":48.23804855,"LON":16.31670952,"ALT":244,"SAT":0,"SFIX":false,"HDOP":0,"RATE":1200,"NEXT":1049,"DIST":0,
             * "DIRn":0,"DIRo":0,"DATE":"2024-01-28 19:50:21"}
             * 
             * WX Data
             * DW{"TYP":"W","TEMP":21.5437355,"TOUT":19.9375,"HUM":52.65787888,"PRES":1007.27002,"QNH":1036.137817,"ALT":49,"GAS":41.37799835,"CO2":0}
             * 
             * Info Data:
             * DI{"TYP":"I","FWVER":"C 4.29 d","CALL":"OE1KFR-2","ID":3215539008,"HWID":10,"MAXV":4.239999771,"ATXT":"","BLE":"short","BATP":0,"BATV":1.86}
             * 
             */


            case 0x44:  {
                // if a message starts with P or W we got gps info or wx info from node
                console.log("Data Msg received");

                // print the whole message
                let msg_text = "";

                // GPSData, WxData, InfoData Message from Node "G", "W", "I"
                const msg_type = String.fromCharCode(msg.getUint8(1));

                // get the message from dataview as string
                let txt_arr: number[] = [];

                for (let i = 0; i < msg_len; i++) {
                    //read till 0x00 byte in APRS msg
                    if (msg.getUint8(i) === 0) break;
                    txt_arr[i] = msg.getUint8(i);
                }

                let msg_text_ = convBARRtoStr(txt_arr);
                // convert to string
                console.log("Data Msg: " + msg_text_);

                let json_str = "";

                // remove the Data Identifier Byte
                json_str = msg_text_.slice(1, msg_text_.length);


                //console.log("JSON String: " + json_str);

                switch (msg_type){

                    case "{": {

                        if (!json_str.endsWith("}")) return;

                        console.log("Json Data received!");
                        /**{"TYP":"SE","BME":false,"BMP":false,"680":true,"811":false,"LPS33":false,"OW":false,"OWPIN":4} */
                        
                        // There should always be a field "TYP" which gives us the type of the json data
                        const json_data = JSON.parse(json_str);

                        // check if one of the fields is undefined or null.
                        if(!checkJSON(json_data)){
                            console.log("ERROR: JSON Data incomplete!");
                            break;
                        }

                        const json_type = json_data.TYP;
                        console.log("Json Type: " + json_type);

                        switch (json_type) {

                            case "G": {

                                console.log("GPS Data received!");
                                const gps_data: GpsData = JSON.parse(json_str);

                                // PRINT ALL GPS DATA
                                const lat = gps_data.LAT;
                                console.log("Lat: " + lat);
                                const lon = gps_data.LON;
                                console.log("Lon: " + lon);
                                const alt = gps_data.ALT;
                                console.log("Alt: " + alt);
                                const sat = gps_data.SAT;
                                console.log("Sat: " + sat);
                                const sfix = gps_data.SFIX;
                                console.log("Sfix: " + sfix);
                                let DateTime_gps = gps_data.DATE;
                                console.log("DateTime: " + DateTime_gps);
                                //const utc_offset = gps_data.UTCOFF;
                                //console.log("UTC Offset: " + utc_offset);

                                // set the position in the references
                                /*latitude_ref.current = lat;
                                longitude_ref.current = lon;
                                altitude_ref.current = alt;*/


                                // if default date is 2023-01-01 we have no valid date, set phone date
                                if (DateTime_gps.startsWith("2023-01-01")) {
                                    console.log("No valid GPS Date, set Phone Date");
                                    DateTime_gps = date_now + " " + time;
                                    gps_data.DATE = DateTime_gps;
                                }

                                // set the static config object
                                ConfigObject.setOwnPosition(gps_data);

                                // update config store
                                ConfigStore.update(s => {
                                    s.config.lat = +gps_data.LAT.toFixed(POS_DECIMALS);
                                    s.config.lon = +gps_data.LON.toFixed(POS_DECIMALS);
                                    s.config.alt = gps_data.ALT;
                                });

                                //update own position in the positions DB
                                console.log("MHANDLER: Update Own Position in DB Callsign: " + node_call_ref.current)
                                let db_pos = null;
                                db_pos = await DatabaseService.getPos(node_call_ref.current).then((pos: PosType | null) => {
                                    if (pos !== null && pos !== undefined) {
                                        console.log("MHANDLER: Own Position found in DB: " + JSON.stringify(pos));
                                        return pos;
                                    } else {
                                        console.log("MHandler: Own Position not found in DB! Adding Raw Position!")
                                        const newOwnPos: PosType = {
                                            timestamp: now_timestamp,
                                            callSign: node_call_ref.current,
                                            lat: +gps_data.LAT.toFixed(POS_DECIMALS),
                                            lon: +gps_data.LON.toFixed(POS_DECIMALS),
                                            alt: gps_data.ALT,
                                            bat: "0",
                                            hw: "0",
                                            pressure: 0,
                                            temperature: 0,
                                            humidity: 0,
                                            qnh: 0,
                                            comment: " ",
                                            temp_2: 0,
                                            co2: 0,
                                            alt_press: 0,
                                            gas_res: 0
                                        }
                                        return newOwnPos;
                                    }
                                });
                                
                                const curr_call = ConfigObject.getConf().CALL;

                                if(db_pos !== null && db_pos !== undefined && curr_call !== "" && curr_call !== "XX0XXX-00"){
                                    console.log("MHANDLER: Update Position in DB");
                                    db_pos.lat = +gps_data.LAT.toFixed(POS_DECIMALS);
                                    db_pos.lon = +gps_data.LON.toFixed(POS_DECIMALS);
                                    db_pos.alt = gps_data.ALT;

                                    await DatabaseService.writePos(db_pos);
                                }

                                GpsDataStore.update(s => {
                                    s.gpsData = gps_data;
                                });

                                break;
                            }

                            case "W": {

                                console.log("WX Data received!");
                                const wx_data: WxData = JSON.parse(json_str);

                                const temp = wx_data.TEMP;
                                console.log("Temp: " + temp);
                                console.log("TOUT: " + wx_data.TOUT);
                                console.log("HUM: " + wx_data.HUM);
                                console.log("PRES: " + wx_data.PRES);
                                console.log("QNH: " + wx_data.QNH); 

                                WxDataStore.update(s => {
                                    s.wxData = wx_data;
                                });

                                // update wxdata in own position in db -> needed by the map
                                console.log("MHANDLER: Update Own Position WX Measurements in DB Callsign: " + node_call_ref.current);
                                let db_pos = null;
                                db_pos = await DatabaseService.getPos(node_call_ref.current).then((pos: PosType | null) => {
                                    if (pos !== null && pos !== undefined) {
                                        console.log("MHANDLER: Own Position found in DB: " + JSON.stringify(pos));
                                        pos.temperature = +wx_data.TEMP.toFixed(1);
                                        pos.humidity = +wx_data.HUM.toFixed(1);
                                        pos.pressure = +wx_data.PRES.toFixed(2);
                                        pos.qnh = +wx_data.QNH.toFixed(2);
                                        pos.alt_press = +wx_data.ALT.toFixed(0);
                                        pos.gas_res = +wx_data.GAS.toFixed(1);
                                        pos.co2 = +wx_data.CO2.toFixed(1);
                                        return pos;
                                    }
                                });

                                if(db_pos !== null && db_pos !== undefined){
                                    console.log("MHANDLER: Update Position in DB");
                                    await DatabaseService.writePos(db_pos);
                                }
                                

                                /*ConfigStore.update(s => {
                                    s.config.onewire_pin = wx_data.OWPIN;
                                    s.config.onewire_on = wx_data.OWON;
                                    s.config.lps33_on = wx_data.LPS33ON;
                                    s.config.bme680_on = wx_data.BME680ON;
                                    s.config.mcu811_on = wx_data.MCU811ON;
                                });*/

                                break;
                            }

                            case "I": {

                                console.log("Info Data received!");
                                const info_data: InfoData = JSON.parse(json_str);

                                // update infodata in ConfigObject
                                // needed for connect Page
                                ConfigObject.setConf(info_data);

                                // update Node Info Store
                                NodeInfoStore.update(s => {
                                    s.infoData = info_data;
                                });

                                const callsign = info_data.CALL;
                                console.log("Node Callsign: " + callsign);
                                // update callsign ref
                                node_call_ref.current = callsign;

                                // show set baseconfig alert on unset node
                                if (callsign === "" || callsign === "XX0XXX-00") {
                                    console.log("Mhandler - Callsign not set!");
                                    //redirect to settings tab
                                    ShouldConfStore.update(s => {
                                        s.shouldConf = true;
                                    });
                                }

                                const fw_vers = info_data.FWVER;
                                console.log("FW Version: " + fw_vers);

                                const aprs_cmt = info_data.ATXT;
                                // update comment in store
                                AprsCmtStore.update(s => {
                                    s.aprsCmt = aprs_cmt;
                                });

                                console.log("APRS Comment: " + aprs_cmt);

                                // ID is currently not used
                                const id = info_data.ID;
                                console.log("ID: " + id);

                                const ble_short_long = info_data.BLE;
                                console.log("BLE short/long: " + ble_short_long);

                                const hw_id = info_data.HWID;
                                console.log("HW ID: " + hw_id);

                                const max_v = info_data.MAXV;
                                console.log("Max Voltage: " + max_v);

                                const batt_perc = info_data.BATP;
                                console.log("Battery Percentage: " + batt_perc);
                                const batt_volt = +info_data.BATV.toFixed(2);
                                console.log("Battery Voltage: " + batt_volt);

                                // update config store
                                ConfigStore.update(s => {
                                    s.config.callSign = callsign;
                                    s.config.fw_ver = fw_vers;
                                    s.config.hw = hwtable[hw_id];
                                    s.config.comment = aprs_cmt;
                                    s.config.bat_perc = batt_perc;
                                    s.config.bat_volt = batt_volt;
                                });

                                // update aprs comment store
                                AprsCmtStore.update(s => {
                                    s.aprsCmt = aprs_cmt;
                                });

                                break;

                            }

                            case "SE": {
                                console.log("Sensor Settings received!");

                                const sensor_settings:SensorSettings = json_data;
                                console.log("Sensor Settings: " + JSON.stringify(sensor_settings));

                                console.log("BME680: " + sensor_settings[680]);
                                console.log("BMP280: " + sensor_settings.BMP);
                                console.log("BME280: " + sensor_settings.BME);
                                console.log("Onewire: " + sensor_settings.OW);
                                console.log("Onewire Pin: " + sensor_settings.OWPIN);
                                console.log("LPS33: " + sensor_settings.LPS33);
                                console.log("MCU811: " + sensor_settings[811]);

                                // update config store
                                ConfigStore.update(s => {
                                    s.config.onewire_pin = sensor_settings.OWPIN;
                                    s.config.onewire_on = sensor_settings.OW;
                                    s.config.lps33_on = sensor_settings.LPS33;
                                    s.config.bme680_on = sensor_settings[680];
                                    s.config.mcu811_on = sensor_settings[811];
                                    s.config.bme_on = sensor_settings.BME;
                                    s.config.bmp_on = sensor_settings.BMP;
                                });

                                SensorSettingsStore.update(s => {
                                    s.sensorSettings = sensor_settings;
                                });


                                break;
                            }

                            case "SW": {
                                console.log("Wifi Settings received!");
                                //{"TYP":"SW", "SSID":"string up to 30 chars?","PW":"also a long string", "IP":"192.168.1.123", "GW":"192.168.1.1", "DNS":"192.168.1.1", "SUB":"255.255.255.0"}

                                const wifi_settings:WifiSettings = json_data;

                                console.log("Wifi SSID: " + wifi_settings.SSID);
                                console.log("Wifi IP: " + wifi_settings.IP);
                                console.log("Wifi GW: " + wifi_settings.GW);
                                console.log("Wifi DNS: " + wifi_settings.DNS);
                                console.log("Wifi SUB: " + wifi_settings.SUB);

                                // update config store
                                WifiSettingsStore.update(s => {
                                    s.wifiSettings = wifi_settings;
                                });

                                ConfigStore.update(s => {
                                    s.config.wifi_ssid = wifi_settings.SSID;
                                    s.config.wifi_pwd = wifi_settings.PW;
                                });

                                break;
                            }

                            case "SN": {
                                //{"TYP":"SN","GW":false,"DISP":true,"BTN":false,"MSH":true,"GPS":false,"TRACK":false,"UTCOF":28.2730,"TXP":22,
                                //"MQRG":433.175,"MSF":11,"MCR":6,"MBW":250}

                                console.log("Node Settings received!");

                                const node_settings:NodeSettings = json_data;

                                console.log("GW: " + node_settings.GW);
                                console.log("WS: " + node_settings.WS);
                                console.log("DISP: " + node_settings.DISP);
                                console.log("BTN: " + node_settings.BTN);
                                console.log("MSH: " + node_settings.MSH);
                                console.log("GPS: " + node_settings.GPS);
                                console.log("TRACK: " + node_settings.TRACK);
                                console.log("UTCOF: " + node_settings.UTCOF.toFixed(1));
                                console.log("TXP: " + node_settings.TXP);
                                console.log("MQRG: " + node_settings.MQRG);
                                console.log("MSF: " + node_settings.MSF);

                                // update config store
                                ConfigStore.update(s => {
                                    s.config.gw_on = node_settings.GW;
                                    s.config.display_off = node_settings.DISP;
                                    s.config.button_on = node_settings.BTN;
                                    s.config.mesh_on = node_settings.MSH;
                                    s.config.gps_on = node_settings.GPS;
                                    s.config.track_on = node_settings.TRACK;
                                    s.config.node_utc_offset = +node_settings.UTCOF.toFixed(1);
                                    s.config.tx_pwr = node_settings.TXP;
                                    s.config.frequency = +node_settings.MQRG.toFixed(3);
                                });

                                // update nodesettings store
                                NodeSettingsStore.update(s => {
                                    s.nodeSettings = node_settings;
                                });

                                break;
                            }

                            case "SA": {
                                //{"TYP":"SA","ATXT":"none","SYMID":"/","SYMCD":"#"}
                                console.log("APRS Settings received!");

                                const aprs_settings:AprsSettings = json_data;

                                console.log("APRS Comment: " + aprs_settings.ATXT);
                                console.log("APRS Symbol ID: " + aprs_settings.SYMID);
                                console.log("APRS Symbol Char: " + aprs_settings.SYMCD);

                                // get the symbol name from the symbol char
                                let aprs_symbol_name = "";
                                //get aprs symbol name
                                if (aprs_settings.SYMID === "/") {
                                    aprs_pri_symbols.forEach(element => {
                                        if (element.s_char.includes(aprs_settings.SYMCD)) {
                                            aprs_symbol_name = element.s_name
                                        }
                                    });
                                } else {
                                    aprs_sec_symbols.forEach(element => {
                                        if (element.s_char.includes(aprs_settings.SYMCD)) {
                                            aprs_symbol_name = element.s_name
                                        }
                                    });
                                }

                                console.log("APRS Sym Name: " + aprs_symbol_name);

                                // update config store
                                ConfigStore.update(s => {
                                    s.config.aprs_pri_sec = aprs_settings.SYMID;
                                    s.config.aprs_symbol = aprs_symbol_name;
                                });

                                // update aprs comment store
                                AprsCmtStore.update(s => {
                                    s.aprsCmt = aprs_settings.ATXT;
                                });

                                break;
                            }

                            case "MH": {
                                // D{"TYP":"MH","CALL":"OE1KFR-2","DATE":"2023-01-01","TIME":"00:00:41","PLT":33,"HW":10,"MOD":3,"RSSI":-44,"SNR":6}
                                console.log("Mheard received!");

                                const mheard:Mheard = json_data;

                                console.log("Mheard Call: " + mheard.CALL);

                                if (mheard.CALL === "XX0XXX-00") break;

                                if (node_call_ref.current === "") {
                                    console.log("MHANDLER: Node Call not set yet!");
                                    break;
                                }

                                if(mheard.CALL === node_call_ref.current){
                                    console.log("MHANDLER: Warning! Mheard Call is own Node Call!");
                                    break;
                                }

                                if(mheard.DATE === "2023-01-01"){
                                    mheard.DATE = date_now;
                                    mheard.TIME = time;
                                }

                                // if distance is not set from node, check if position is cached in MheardStaticStore and calc distance
                                let calced_dist = 0;

                                if(mheard.DIST === 0){
                                    const cachedPos = MheardStaticStore.getCachedPos(mheard.CALL);
                                    if(cachedPos.length === 1){
                                        console.log("MHANDLER: Mheard Cached Position found for: " + mheard.CALL);
                                        console.log("MHANDLER: Mheard Cached Pos: " + JSON.stringify(cachedPos));
                                        // calculate distance
                                        calced_dist = calcDistance(cachedPos[0]);
                                        console.log("MHANDLER: Mheard Calced Distance: " + calced_dist);
                                    }
                                    if (cachedPos.length === 0){
                                        console.log("MHANDLER: Mheard no Cached Position found for: " + mheard.CALL);
                                        // get it from the DB
                                        await DatabaseService.getPos(mheard.CALL).then((pos: PosType | null) => {
                                            if (pos !== null && pos !== undefined) {
                                                MheardStaticStore.setCachedPos(pos);
                                                // calculate distance
                                                calced_dist = calcDistance(pos);
                                                console.log("MHANDLER: Mheard Calced Distance: " + calced_dist);
                                            } else {
                                                console.log("MHANDLER: Mheard Position not found in DB!");
                                            }
                                        });
                                    }
                                }

                                if (calced_dist !== 0 && mheard.DIST === 0) {
                                    mheard.DIST = calced_dist;
                                }

                                const new_mheard:MheardType = {
                                    mh_timestamp:now_timestamp,
                                    mh_nodecall:node_call_ref.current,
                                    mh_callSign:mheard.CALL,
                                    mh_date:mheard.DATE,
                                    mh_time:mheard.TIME,
                                    mh_rssi:mheard.RSSI,
                                    mh_snr:mheard.SNR,
                                    mh_hw:hwtable[mheard.HW],
                                    mh_distance:+mheard.DIST.toFixed(2),
                                    mh_pl:mheard.PL,
                                    mh_mesh:mheard.MESH
                                }

                                return (new_mheard);
                            }

                            case "CONFFIN": {
                                console.log("Config Finished received!");
                                // set the config finished flag in the store
                                BleConfigFinish.update(s => {
                                    s.BleConfFin = Date.now();
                                });
                                
                                break;
                            }
                        }
                        break;
                    }
                }
                break;
            }
            default:
                console.log("Msg Flag did not match!");
        }
    }

    

    //process altitude and bat strings 
    const convertAlt = (alt_str: string):number => {
        //console.log("Altitude String: " + alt_str);
        let alt_nr_meter = +alt_str * 0.3048;
        alt_nr_meter = Math.round(alt_nr_meter);
        //console.log("Pos Msg Alt Meter: " + alt_nr_meter);
        return alt_nr_meter;
    }


    // convert string to ascii (number) array for sending to node
    const convSTRtoARR = (str:string): number[] => {
        let ascii_arr: number[] = [];
        for (let i = 0; i < str.length; i++) {
            ascii_arr[i] = str.charCodeAt(i);
        }
        return ascii_arr;
    }


    // convert byte array to string
    const convBARRtoStr = (arr: number[]): string => {
        let str = String.fromCharCode.apply(null, arr);
        const arr_len = arr.length;
        // bad design to copy the array. change the number arrays above to Uint8array
        let textbuff = new Uint8Array(arr_len);

        for(let i=0; i<arr_len; i++){
            textbuff[i] = arr[i];
        }

        const str_dec = new TextDecoder();
        const dec_txt_msg = str_dec.decode(textbuff);
        return dec_txt_msg;
    }

    // check the fields of the jsons if they are undefined. Returns true if all fields are defined
    const checkJSON = (json: any): boolean => {

        const keys = Object.keys(json) as Array<keyof typeof json>;

        keys.forEach((key) => {
            if (json[key] === undefined || json[key] === null) {
                console.log("ERROR: JSON Key: " + String(key) + " is undefined!");
                return false;
            }
            console.log("Key: " + String(key) + "-> " + json[key]);
        });
        return true;
    }

    // calculate the distance between two nodes if the node does not provide the distance
    const calcDistance = (pos:PosType): number => {

        // get the own position
        const own_lat = ConfigObject.getOwnPosition().LAT;
        const own_lon = ConfigObject.getOwnPosition().LON;

        if (own_lat === 0 || own_lon === 0) {
            console.log("MHANDLER: Own Position not set!");
            return 0;
        }

        // calculate the distance
        let radlat1 = Math.PI * pos.lat / 180;
        let radlat2 = Math.PI * own_lat / 180;
        let theta = pos.lon - own_lon;
        let radtheta = Math.PI * theta / 180;
        let distance = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (distance > 1) {
            distance = 1;
        }
        distance = Math.acos(distance);
        distance = distance * 180 / Math.PI;
        distance = distance * 60 * 1.1515;
        distance = distance * 1.609344;

        distance = Math.round(distance * 100) / 100;

        return distance;
    }

    return {
        parseMsg,
        convSTRtoARR,
        convBARRtoStr
    }
}