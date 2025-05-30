
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
import {aprs_char_table, aprs_pri_symbols} from '../store/AprsSymbols';
import {hwtable} from '../store/HwTable';
import {modtable} from '../store/ModTable';
import { format, compareAsc, isAfter, fromUnixTime, isBefore } from "date-fns";
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
import LogS from '../utils/LogService';
import AprsSettingsStore from '../store/AprSettingsStore';


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
                let isGrpMsg_ = 0;
                let grpNum_ = 0;
                
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
                        if(isAfter(unix_time, new Date(2024,1,1)) && isBefore(unix_time, now_timestamp + /*24h */ 86400000)){
                            timestamp_node = unix_time;
                        } else {
                            console.log("Node Time not valid! Using current time!");
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

                        // check if the dm call is a group message aka a number
                        if(!isNaN(+dm_callsign)){
                            isGrpMsg_ = 1;
                            grpNum_ = +dm_callsign;
                            console.log("Group Message Nr: " + grpNum_);
                        }

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
                            isGrpMsg: isGrpMsg_,
                            grpNum: grpNum_,
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

                //console.log("OLD Config Msg received");

                /*
                LENGTH 2B - FLAG 1B - LENCALL 1B - Callsign - LAT 8B(Double) - LON 8B(Double) - ALT 4B(INT) - 1B SSID_Length - Wifi_SSID - 1B Wifi_PWD - Wifi_PWD 
                - 1B APRS_PRIM_SEC - 1B APRS_SYMBOL - 4B SettingsMask - 1B HW-ID - 1B MOD-ID - 1B FW_Version - 1B Comment Length - Comment - 4B Settingsbyte2 - 0x00
                */

                break;
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

                                LogS.log(0, "GPS Data received!");
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

                                LogS.log(0, "WX Data received!");
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

                                break;
                            }

                            case "I": {

                                LogS.log(0, "NodeInfo Data received!");
                                const info_data: InfoData = JSON.parse(json_str);

                                // update infodata in ConfigObject
                                // needed for connect Page
                                ConfigObject.setConf(info_data);

                                // update Node Info Store
                                NodeInfoStore.update(s => {
                                    s.infoData = info_data;
                                });

                                const callsign = info_data.CALL;
                                LogS.log(0, "Node Callsign: " + callsign);
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
                                    s.config.bat_perc = batt_perc;
                                    s.config.bat_volt = batt_volt;
                                });

                                // update aprs comment store
                                /*AprsCmtStore.update(s => {
                                    s.aprsCmt = aprs_cmt;
                                });*/

                                break;

                            }

                            case "SE": {
                                LogS.log(0, "Sensor Settings received!");

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
                                LogS.log(0, "Wifi Settings received!");
                                //{"TYP":"SW", "SSID":"string up to 30 chars?","PW":"also a long string", "IP":"192.168.1.123", "GW":"192.168.1.1", "DNS":"192.168.1.1", "SUB":"255.255.255.0"}

                                const wifi_settings:WifiSettings = json_data;

                                console.log("Wifi SSID: " + wifi_settings.SSID);
                                console.log("Wifi IP: " + wifi_settings.IP);
                                console.log("Wifi GW: " + wifi_settings.GW);
                                console.log("Wifi DNS: " + wifi_settings.DNS);
                                console.log("Wifi SUB: " + wifi_settings.SUB);
                                console.log("Wifi AP: " + wifi_settings.AP);

                                // update config store
                                WifiSettingsStore.update(s => {
                                    s.wifiSettings = wifi_settings;
                                });

                                ConfigStore.update(s => {
                                    s.config.wifi_ssid = wifi_settings.SSID;
                                });

                                break;
                            }

                            case "SN": {
                                //{"TYP":"SN","GW":false,"DISP":true,"BTN":false,"MSH":true,"GPS":false,"TRACK":false,"UTCOF":28.2730,"TXP":22,
                                //"MQRG":433.175,"MSF":11,"MCR":6,"MBW":250,"GWNPOS":false}

                                LogS.log(0, "Node Settings received!");

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
                                console.log("GWNPOS: " + node_settings.GWNPOS);

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
                                LogS.log(0, "APRS Settings received!");

                                const aprs_settings:AprsSettings = json_data;

                                console.log("APRS Comment: " + aprs_settings.ATXT);
                                console.log("APRS Symbol ID: " + aprs_settings.SYMID);
                                console.log("APRS Symbol Char: " + aprs_settings.SYMCD);
                                console.log("APRS Name: " + aprs_settings.NAME);

                                // get the symbol name from the symbol char
                                let aprs_symbol_name = "";
                                //get aprs symbol name
                                if (aprs_settings.SYMID === "/" || aprs_settings.SYMID === "\\") {
                                    aprs_pri_symbols.forEach(element => {
                                        if (element.s_char.includes(aprs_settings.SYMCD) && element.s_group === aprs_settings.SYMID) {
                                            aprs_symbol_name = element.s_name
                                        }
                                    });
                                }

                                if(aprs_symbol_name === ""){
                                    console.log("APRS Symbol not found in Symbol Table!");
                                    aprs_symbol_name = aprs_settings.SYMCD;
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

                                // update aprs settings store
                                AprsSettingsStore.update(s => {
                                    s.aprsSettings = aprs_settings;
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

                                // if distance is not set from node, check if position is cached in MheardStaticStore and calc distance
                                /*let calced_dist = 0;

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
                                }*/

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
                                LogS.log(0, "Config Finished received!");
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
                LogS.log(1, "Msg Flag did not match!");
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