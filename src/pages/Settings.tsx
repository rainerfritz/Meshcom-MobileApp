
import { IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar, IonLabel, IonInput, IonItem, IonButton, IonToggle, IonRange, IonIcon, IonRow, IonCol, IonGrid, IonSelect, IonSelectOption, useIonViewWillEnter, IonAlert, IonProgressBar, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import {useBLE} from '../hooks/BleHandler';
import { Geolocation } from '@capacitor/geolocation';

import './Settings.css';
import { useStoreState } from 'pullstate';
import { DevIDStore } from '../store';
import { getDevID, getSensorSettings, getBLEconnStore, getConfigStore, getScanResult, getNodeInfoStore, getBleConfFinish, getWifiSettings } from '../store/Selectors';
import ConfigStore from '../store/ConfStore';
import { ConfType, InfoData, SensorSettings,WifiSettings, NodeSettings } from '../utils/AppInterfaces';
import { iosTransitionAnimation, RangeValue } from '@ionic/core';
import { chevronDown, chevronForward, eyeOutline, eyeOffOutline, send, add } from 'ionicons/icons';
import {aprs_char_table, aprs_pri_symbols} from '../store/AprsSymbols';
import AlertCard from '../components/AlertCard';
import AprsCmtStore from '../store/AprsCmtStore';
import { useHistory } from "react-router";
import GpsDataStore from '../store/GpsData';
import ScanI2CStore from '../store/ScanI2CStore';
import SensorSettingsStore from '../store/SensorSettings';
import BLEconnStore from '../store/BLEconnected';
import DataBaseService from '../DBservices/DataBaseService';
import NodeInfoStore from '../store/NodeInfoStore';
import AppActiveState from '../store/AppActive';
import WifiSettingsStore from '../store/WifiSettings';
import NodeSettingsStore from '../store/NodeSettingsStore';
import LogS from '../utils/LogService';
import MheardStaticStore from '../utils/MheardStaticStore';
import AprsSettingsStore from '../store/AprSettingsStore';




const Tab2: React.FC = () => {

  // currently settings are saved when config message comes back from phone

  // BLE TX function
  const {sendDV, sendTxtCmdNode, updateDevID, updateBLEConnected} = useBLE();

  // history forward to page
  const history = useHistory();

  // devid from store
  const devID_s = useStoreState(DevIDStore, getDevID);

  //config from sate store
  const config_s:ConfType = useStoreState(ConfigStore, getConfigStore);

  // BLE connected from store
  const ble_connected:boolean = useStoreState(BLEconnStore, getBLEconnStore);

  // wifii settings from store
  const wifiSettings_s:WifiSettings = WifiSettingsStore.useState(s => s.wifiSettings);

  // node settings
  const nodeSettings:NodeSettings = useStoreState(NodeSettingsStore, s => s.nodeSettings);

  // sensor settings from store
  const sensorSettings_s:SensorSettings = useStoreState(SensorSettingsStore, s => s.sensorSettings);

  // aprs settings from store
  const aprs_settings_s = AprsSettingsStore.useState(s => s.aprsSettings);

  // get current AppState
  const isAppActive = AppActiveState.useState(s => s.active);

  // trigger if we have an unconfiuired node
  //const shouldConf = useStoreState(ShouldConfStore, s => s.shouldConf);

  // NodeInfos
  const nodeInfo_s:InfoData = NodeInfoStore.useState(s => s.infoData);
  



  // remember which setting changed to send it to node
  const call_changed = useRef<boolean>(false);
  const wifi_changed = useRef<boolean>(false);
  const aprsSym_changed = useRef<boolean>(false);
  const aprs_cmt_changed = useRef<boolean>(false);
  const aprs_cmt_store = useStoreState(AprsCmtStore, s => s.aprsCmt);


  // references to the server userinput textfields 
  const callInputRef = useRef<HTMLIonInputElement>(null);
  const ssidInputRef = useRef<HTMLIonInputElement>(null);
  const wifipwdInputRef = useRef<HTMLIonInputElement>(null);
  const aprsCmtRef = useRef<HTMLIonInputElement>(null);

  // Regex for callsign check
  const regexCallsign = /^([A-Z]{1,3}[0-9]{1,2}[A-Z]{0,3}|[0-9][A-Z][0-9][A-Z]{1,3})-[0-9]{1,2}$/;

  // switch show wifi pwd
  const [shWifiPwd, setShWifiPwd] = useState<boolean>(false);

  // show advanced settings
  const [shAdvSetting, setshAdvSetting] = useState<boolean>(false);

  // APRS primary Symbols
  const aprs_symbols_mapped = useRef<aprs_char_table []>(aprs_pri_symbols);
  const aprs_pri_sec_char = useRef<string>("/");
  const aprs_sym_char = useRef<string>("#");
  const aprs_sym_char_Input_ref = useRef<HTMLIonInputElement>(null);
  const aprs_pri_sec_char_Input_ref = useRef<HTMLIonInputElement>(null);
  const aprssym_valid = useRef<boolean>(true);
  const aprs_pri_sec_valid = useRef<boolean>(true);

  // alertcard handling
  const [shAlertCard, setShAlertCard] = useState<boolean>(false);
  const [alHeader, setAlHeader] = useState<string>("");
  const [alMsg, setAlMsg] = useState<string>("");

  // disco card params
  const [shDiscoCard, setShDiscoCard] = useState<boolean>(false);

  // remember if this page is active
  const thisPageActive = useRef<boolean>(false);
 
  // tx power settings
  const [txpower_slider, setTxpower_slider] = useState<RangeValue>();
  // SX127x MinPwr: 5, MaxPwr: 17; SX126x MinPwr: -5, MaxPwr: 22; E22 +8db PA
  const minTXpwr = useRef<number>(5);
  const maxTXpwr = useRef<number>(17);
  const tx_pwr = useRef<number>(17);
  const [tx_pwr_w, setTxPwrW] = useState<number>(17);
  const [shTxPwrSlider, setShTxPwrSlider] = useState<boolean>(false);

  // reboot node 
  const [shRebootCard, setShRebootCard] = useState<boolean>(false);

  // OTA Update Card Yes/No
  const [shOTAUpdateCard, setShOTAUpdateCard] = useState<boolean>(false);

  // onewire pin ref
  const owPinInputRef = useRef<HTMLIonInputElement>(null);
  const owPinNr = useRef<number>(0);
  const owPinChanged = useRef<boolean>(false);
  let MAX_PIN_NUM = 50;

  // userbutton pin ref
  const userBtnInputRef = useRef<HTMLIonInputElement>(null);
  const userBtnNr = useRef<number>(0);
  const userBtnChanged = useRef<boolean>(false);
  let MAX_USER_BTN_NUM = 50;

  // Node UTC Time-Offset setting
  const node_utc_offset = useRef<number>(0);
  const node_utc_offset_changed = useRef<boolean>(false);
  const node_utc_offset_ref = useRef<HTMLIonInputElement>(null);

  // custom BLE Pairing Ping
  const ble_pairing_pin = useRef<string>("000000");
  const ble_pairing_pin_changed = useRef<boolean>(false);
  const ble_pairing_pin_ref = useRef<HTMLIonInputElement>(null);

  // show hide user buttons
  const [shUserBtns, setShUserBtns] = useState<boolean>(false);

  // I2C Scanresult
  const scanResult = useStoreState(ScanI2CStore, getScanResult);

  // timer to count how often sendpos and sendtrackwas sent
  let now_obj = new Date();
  const txpos_last = useRef<number>(Date.now());
  const minWaitTime_txpos = 10000; // 10 sec

  // country settings 
  // {"EU", "EU8", "UK", "EA", "US", "VR2", "868", "915", "MAN"};
  const [shCtrySetting, setShCtrySetting] = useState<boolean>(false);
  const ctrySetting = NodeInfoStore.useState(s => s.infoData.CTRY);
  const ctry_setting_changed = useRef<boolean>(false);
  const ctry_setting_changed_str = useRef<string>("");
  // sets the ctry setting to the node
  const setCtryNode = (ctry_ev:string) => {
    console.log("Setting Country: " + ctry_ev);
    ctry_setting_changed.current = true;
    ctry_setting_changed_str.current = ctry_ev;
    NodeInfoStore.update(s => {
      s.infoData.CTRY = ctry_ev;
    });
  }
  const ctry_list = ["EU", "EU8", "ON", "UK", "LA", "UK8", "US", "VR2", "868", "906"];
  const ctry_list_translated: {[key: string]: string} = 
  {"EU":"EU | 433.175MHz", 
  "EU8":"EU8 | 433.175MHz",
  "UK":"UK | 439.9125MHz",
  "UK8":"UK8 | 439.9125MHz",
  "US":"US | 433.175MHz", 
  "VR2":"VR2 | 435.775MHz", 
  "868":"868 | 869.525MHz", 
  "906":"906 | 906.875MHz",
  "LA":"LA | 433.925MHz"};
  // set the ctry setting changed string to value when recived from node
  useEffect(()=>{
    console.log("Ctry Setting set from Node: " + ctrySetting);
    ctry_setting_changed_str.current = ctrySetting;
  },[ctrySetting]);

  // Group Call Settings
  const [shGroupCallSet, setShGroupCallSet] = useState<boolean>(false);
  const setGrpCmd = useRef<string>("");
  const groupSettingChanged = useRef<boolean>(false);
  // references for the inputs
  const gcb0Ref = useRef<number>(0);
  const gcb1Ref = useRef<number>(0);
  const gcb2Ref = useRef<number>(0);
  const gcb3Ref = useRef<number>(0);
  const gcb4Ref = useRef<number>(0);
  const gcb5Ref = useRef<number>(0);
  const grp0 = gcb0Ref.current = NodeInfoStore.useState(s => s.infoData.GCB0);
  const grp1 = gcb1Ref.current = NodeInfoStore.useState(s => s.infoData.GCB1);
  const grp2 = gcb2Ref.current = NodeInfoStore.useState(s => s.infoData.GCB2);
  const grp3 = gcb3Ref.current = NodeInfoStore.useState(s => s.infoData.GCB3);
  const grp4 = gcb4Ref.current = NodeInfoStore.useState(s => s.infoData.GCB4);
  const grp5 = gcb5Ref.current = NodeInfoStore.useState(s => s.infoData.GCB5);
  
  // reset the group call settings
  const resetGrpCall = () => {
    console.log("Reset Group Call Settings");
    // send to node
    sendTxtCmdNode("--setgrc");
  }

  // fixed ip settings
  const [shFixedIPSet, setShFixedIPSet] = useState<boolean>(false);
  const fixed_ip_changed = useRef<boolean>(false);
  const ip_addr_ref = useRef<HTMLIonInputElement>(null);
  const ip_gw_ref = useRef<HTMLIonInputElement>(null);
  const ip_snm_ref = useRef<HTMLIonInputElement>(null);
  


  // Tasks we need to do when we enter the page
  useIonViewDidEnter(() => {
    // update the ble devid from pullsate store
    thisPageActive.current = true;
    const devid = devID_s;
    updateDevID(devid);
    console.log("Settings Page: Updating DevID " + devid);
    const bleconn = ble_connected;
    console.log("Settings Page BLE connected: " + bleconn);
    updateBLEConnected(bleconn);

  });

  // Tasks we need to do when we leave the page
  useIonViewWillLeave(() => {
    thisPageActive.current = false;
  });

  // trigger the BLE disco function when we disconnect and on page
  useEffect(() => {
    if (!ble_connected && thisPageActive.current) {
      console.log("Settings Page: BLE disconnected!");
      setShDiscoCard(true);
    }
  }, [ble_connected]);




  // when config has changed update aprs symbols
  useEffect(()=>{

    console.log("Settings Config changed");
    
    console.log("Call: " + config_s.callSign);
    console.log("Lat: " + config_s.lat);
    console.log("Lon: " + config_s.lon);
    console.log("Alt: " + config_s.alt);
    console.log("Aprs Pri/Sec: " + aprs_pri_sec_char.current);
    console.log("Aprs Symbol: " + aprs_sym_char.current);
    
    // set onewire pin number from config
    //owPinNr.current = config_s.onewire_pin;
    // set node utc offset from config
    console.log("Node UTC Offset: " + config_s.node_utc_offset);
    node_utc_offset.current = config_s.node_utc_offset;

  }, [config_s]);


  // setting txpower slider and values if nodesettings arrive
  useEffect(()=>{
    LogS.log(0,"Settings Page NodeSettings updated");
    // set min max power based on hw
    const hw_type = config_s.hw;
    if(hw_type === "TBEAM V1.1 1268" || hw_type === "T-ECHO" || hw_type === "RAK4631" || hw_type === "HELTEC V3" || hw_type === "EBYTE E22" || hw_type === "EBYTE E220" || hw_type === "TBEAM V1.2 1262" || hw_type === "TBEAM Supreme L76K" || hw_type === "ESP32-S3 Ebyte"){
      minTXpwr.current = 2;
      maxTXpwr.current = 22;
    }
    else {
      minTXpwr.current = 2;
      maxTXpwr.current = 20;
    }

    // 0 dBm means it was not set to flash on Node
    if(nodeSettings.TXP === 0){
      tx_pwr.current = maxTXpwr.current;
    } else {
      tx_pwr.current = nodeSettings.TXP;
    }
    
    const pwr_exp_w = (tx_pwr.current - 30) / 10;
    const pwr_w = (Math.pow(10, pwr_exp_w) * 1000).toFixed(0); //mW
    console.log("TX Pwr (mW): " + pwr_w);
    setTxPwrW(+pwr_w);

  },[nodeSettings]);


  // set values of sensor settings when they arrive
  useEffect(()=>{
    LogS.log(0,"Settings Page SensorSettings updated");
    // set userbutton pin number from sensor settings
    userBtnNr.current = sensorSettings_s.USERPIN;
    // set onewire pin number from config
    owPinNr.current = sensorSettings_s.OWPIN;

  },[sensorSettings_s]);


  // sleep function for delay
  const sleep = (ms:number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  //send config to phone - we send a string with delimeter Config starts with "C:" 
  /**
  * 
  * Current Config Format from Phone:
  * 
  * LENGTH 1B - FLAG 1B - LENCALL 1B - Callsign - LAT 8B(Double) - LON 8B(Double) - ALT 4B(INT) - 1B SSID_Length - Wifi_SSID - 1B Wifi_PWD - Wifi_PWD 
  * - 1B APRS_PRIM_SEC - 1B APRS_SYMBOL - 4B SettingsMask - 1B HW-ID - 1B MOD-ID - 1B FW-Vers - 1B TX Pwr - 4B Frequency - 1B Comment Length - Comment - 0x00
  * 
  * Config Messages:
  * length 1B - Msg ID 1B - Data
  * 
   * Msg ID:
   * 0x10 - Hello Message (followed by 0x20, 0x30)
   * 0x20 - Timestamp from phone
   * 0x50 - Callsign
   * 0x55 - Wifi SSID and PW
   * 0x70 - Latitude
   * 0x80 - Longitude
   * 0x90 - Altitude
   * 0xA0 - Textmessage
   * 0xF0 - Save Settings at node flash
     * Data:
     * Callsign: length Callsign 1B - Callsign
     * Latitude: 4B Float
     * Longitude: 4B Float
     * Altitude: 4B Integer
   * 
   * WiFi SSID and PWD:
   * 1B - SSID Length - SSID - 1B PWD Length - PWD
   * 
     * Position Settings from phone are: length 1B | Msg ID 1B | 4B lat/lon/alt | 1B save_settings_flag
   * Save_flag is 0x0A for save and 0x0B for don't save
   * If phone send periodicaly position, we don't save them.
  */

  // max values
  const MAX_SSID_CHARS = 33;
  const MAX_PWD_CHARS = 64;
  const MAX_APRS_CMT_CHARS = 20;

   // clear textfields of server userinput
   const clearInput = () => {
    callInputRef.current!.value = "";
  };


  // send new callsign to node
  // returns true if regex of callsign is correct
  const setCallSign = ():boolean => {

    const nodeCall = callInputRef.current!.value;

    if (nodeCall) {

      if (nodeCall.toString() !== "") {

        let call_s = nodeCall.toString();
        call_s = call_s.toUpperCase();
        call_s = call_s.trim();
        console.log("Callsign setting: " + call_s);

        // check if callsign is valid
        if (!regexCallsign.test(call_s)) {
          console.log("Invalid Callsign!");
          clearInput();
          return false;
        }

        let cal_len = call_s.length;
        console.log("Callsign len: " + cal_len);
        if (cal_len > 11) cal_len = 11;

        // dataview object
        let call_buffer = new ArrayBuffer(cal_len + 3);
        
        let view1 = new DataView(call_buffer);
        view1.setUint8(0, cal_len + 3);
        view1.setUint8(1, 0x50);
        view1.setUint8(2, cal_len);
        for(let i=0; i<cal_len; i++)
          view1.setUint8(i+3, call_s.charCodeAt(i));
        //console.log("Store: " + devID_s);
        sendDV(view1, devID_s);


        // update config in store state
        ConfigStore.update(s => {
          s.config.callSign = call_s;
        });
      }
    }
    clearInput();
    return true;
  }


  // get current position from GPS
  /**
   * {"timestamp":1678863572074,"coords":{"heading":-1,"longitude":16.316705541217758,"latitude":48.23804867177001,"speed":-1,
   * "altitudeAccuracy":16.129304885864258,"accuracy":8.02911993815469,"altitude":244.1603012084961}}
   */

  const getGpsData = async (): Promise<{lat:number, lon:number, alt:number, timestamp:number}>  => {

    const coordinates = await Geolocation.getCurrentPosition();
    
    const timestamp_ = coordinates.timestamp;
    let lon_gps = coordinates.coords.longitude;
    let lat_gps = coordinates.coords.latitude;
    let alt_gps = coordinates.coords.altitude;
    if(alt_gps === null) alt_gps = 0;

    //limit decimal 
    lon_gps = Math.round(lon_gps * 100000) / 100000;
    lat_gps = Math.round(lat_gps * 100000) / 100000;
    alt_gps = Math.trunc(alt_gps);
  
    console.log('Current position:', coordinates);


    return {lat:lat_gps, lon:lon_gps, alt:alt_gps, timestamp:timestamp_}
  }



  /**
   * send / configure position on node
   * 
   * Position Settings from phone are: length 1B | Msg ID 1B | 4B lat/lon/alt | 1B save_settings_flag
   * Save_flag is 0x0A for save and 0x0B for don't save on node
   */
  const setCurrentPosGPS = async (save_setting_flag:boolean) => {

    const posObjGPS = await getGpsData();

    // send it directly to the phone
    if(posObjGPS.lat){

        console.log("Latitude to Node: " + posObjGPS.lat); 
        // dataview object
        const lat_len = 7;
        let lat_buffer = new ArrayBuffer(lat_len);
        let view1 = new DataView(lat_buffer);
        view1.setUint8(0, lat_len);
        view1.setUint8(1, 0x70);
        view1.setFloat32(2, posObjGPS.lat, true);

        if(save_setting_flag === true){
          view1.setUint8(6, 0x0A);
        } else {
          view1.setUint8(6, 0x0B);
        }
        
        sendDV(view1, devID_s);

        // update config in store state
        GpsDataStore.update(s => {
           s.gpsData.LAT = posObjGPS.lat;
        });

    }

    if(posObjGPS.lon){

        console.log("Longitude to Node: " + posObjGPS.lon); 
        // dataview object
        const lon_len = 7;
        let lon_buffer = new ArrayBuffer(lon_len);
        let view1 = new DataView(lon_buffer);
        view1.setUint8(0, lon_len);
        view1.setUint8(1, 0x80);
        view1.setFloat32(2, posObjGPS.lon, true);

        if(save_setting_flag === true){
          view1.setUint8(6, 0x0A);
        } else {
          view1.setUint8(6, 0x0B);
        }

        sendDV(view1, devID_s);

        // update config in store state
        GpsDataStore.update(s => {
          s.gpsData.LON = posObjGPS.lon;
        });
    }

    if(posObjGPS.alt){

      console.log("Altitude to Node: " + posObjGPS.alt); 
        // dataview object
        const alt_len = 7;
        let alt_buffer = new ArrayBuffer(alt_len);
        let view1 = new DataView(alt_buffer);
        view1.setUint8(0, alt_len);
        view1.setUint8(1, 0x90);
        view1.setInt32(2, posObjGPS.alt, true);

        if(save_setting_flag === true){
          view1.setUint8(6, 0x0A);
        } else {
          view1.setUint8(6, 0x0B);
        }

        sendDV(view1, devID_s);

        // update config in store state
        GpsDataStore.update(s => {
          s.gpsData.ALT = posObjGPS.alt;
        });
    }

    // if we send periodic position to node -> update config (pos) in DB for Map
    // if position is set as base setting, config gets updated when config message comes back from node
    if(!save_setting_flag){

      console.log("Updating Position on Screen");

      let curr_config = config_s;

      curr_config.lat = posObjGPS.lat;
      curr_config.lon = posObjGPS.lon;
      curr_config.alt = posObjGPS.alt;

      // add config to DB
      //addCONF(curr_config);

    }
  };


  // show user alert that gps pos was set and send setting to node
  const shPosOkCard = () =>{

    setCurrentPosGPS(true);
    setAlHeader("Setting Position successful!");
    setAlMsg("Please save Settings!");
    setShAlertCard(true);

  }



  /**
   * send Wifi Settings to Node
   * Msg ID: 0x55
   * Data:
   * WiFi SSID and PWD:
	 * 1B - SSID Length - SSID - 1B PWD Length - PWD
   * */

  const setWifiSetting = () =>{

    console.log("Setting Wifi Settings");

    const ssidWifi = ssidInputRef.current!.value;
    const pwdWifi = wifipwdInputRef.current!.value;
    
    if(ssidWifi && pwdWifi){

      const ssidWifi_str = ssidWifi!.toString();
      const pwdWifi_str = pwdWifi!.toString();

      // special case reset wifissid to none without pw
      if(ssidWifi_str !== "" && pwdWifi_str !== ""){

        const ssid_len = ssidWifi_str!.length;
        const pwd_len = pwdWifi_str!.length;
        const wifi_conf_len = ssid_len + pwd_len + 4;

        console.log("ssid_len: " + ssid_len);
        console.log("pwd_len: " + pwd_len);
        console.log("wifi_conf_len: " + wifi_conf_len);
        console.log("Wifi SSID: " + ssidWifi_str);
        console.log("Wifi PWD: " + pwdWifi_str);

        //assemble message for node
        // dataview object
        let wifi_buffer = new ArrayBuffer(wifi_conf_len);

        let view1 = new DataView(wifi_buffer);
        view1.setUint8(0, wifi_conf_len);
        view1.setUint8(1, 0x55);
        view1.setUint8(2, ssid_len);
        // fill ssid into buffer
        for(let i=0; i<ssid_len; i++)
          view1.setUint8(i+3, ssidWifi_str.charCodeAt(i));
        // set pwd len
        view1.setUint8(ssid_len + 3, pwd_len);
        // fill pwd into buffer
        for(let i=0; i<pwd_len; i++)
          view1.setUint8((i + ssid_len + 4), pwdWifi_str.charCodeAt(i));

        // send to node
        sendDV(view1, devID_s);

        // update config in store state
        ConfigStore.update(s => {
          s.config.wifi_ssid = ssidWifi_str;
        });

      }

      // reset inputs
      ssidInputRef.current!.value = "";
      wifipwdInputRef.current!.value = "";
    }

  }


  // set APRS Symbol Config
  // 
  const setAprsSymbols = () => {

    console.log("Aprs PriSec to Node: " + aprs_pri_sec_char.current);
    console.log("Aprs Symbol to Node: " + aprs_sym_char.current);

    const symbol_dec = +aprs_sym_char.current.charCodeAt(0);
    console.log("Aprs Symbol DEC: " + symbol_dec);
    
    const symbol_pri_sec = +aprs_pri_sec_char.current.charCodeAt(0);
    console.log("Aprs Pri/Sec DEC: " + symbol_pri_sec);

    // dataview object
    const sym_len = 4;  //1B len - 1B MsgID - 1B SymPriSec - 1B AprsSymbol

    let sym_buffer = new ArrayBuffer(sym_len);
    let view1 = new DataView(sym_buffer);
    view1.setUint8(0, sym_len);
    view1.setUint8(1, 0x95);
    view1.setUint8(2, symbol_pri_sec);
    view1.setUint8(3, symbol_dec);

    sendDV(view1, devID_s);

    sleep(300).then(() => {
      // get the aprs settings from node
      console.log("Get APRS Settings from Node");
      sendTxtCmdNode("--aprsset");
    });

  }


  /**
   * send settings via Textmessage to phone
   * same as serial commands
   * --gateway on/off
   * 
   *  */ 
  const sendTxtCmd = (cmd: string) => {

    // final cmd string
    let cmd_ = "";

    switch (cmd) {

      case "gw": {
        if (!wifiSettings_s.AP) {
          if (config_s.gw_on) {

            cmd_ = "--gateway off";

          } else {

            // check if we have a wifi pw set
            if (config_s.hw !== "RAK4631") {
              if (config_s.wifi_ssid.length > 0 && config_s.wifi_ssid !== "none") {
                cmd_ = "--gateway on";
              } else {
                console.log("Wifi PW not set! GW Mode not possible!");
                setAlHeader("Error!");
                setAlMsg("Wifi Settings not configured!");
                setShAlertCard(true);
              }
            } else {
              cmd_ = "--gateway on";
            }
          }
        } else {
          console.log("AP Mode active! GW Mode not possible!");
          setAlHeader("AP Mode active!");
          setAlMsg("GW Mode not possible!");
          setShAlertCard(true);
        }
        break;
      }

      case "gps": {

        if (config_s.gps_on) {
          cmd_ = "--gps off";
        } else {
          cmd_ = "--gps on";
        }
        break;
      }

      case "bme": {

        if (config_s.bme_on) {
          cmd_ = "--bmx off";
        } else {
          if (config_s.bmp_on || config_s.bme680_on) {
            setAlHeader("Switch BMP280/BME680 off please!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--bme on";
          }
        }
        break;
      }

      case "bmp": {

        if (config_s.bmp_on) {
          cmd_ = "--bmx off";
        } else {
          if (config_s.bme_on || config_s.bme680_on) {
            setAlHeader("Switch BME280/BME680 off please!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--bmp on";
          }
        }
        break;
      }

      case "680": {

        if (config_s.bme680_on) {
          cmd_ = "--680 off";
        } else {
          if (config_s.bme_on || config_s.bmp_on) {
            setAlHeader("Please switch BME/BMP off!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--680 on";
          }
        }
        break;
      }

      case "mcu811": {

        if (config_s.mcu811_on) {
          cmd_ = "--811 off";
        } else {
          cmd_ = "--811 on";
        }
        break;
      }

      case "display": {

        if (config_s.display_off) {
          cmd_ = "--display on";
        } else {
          cmd_ = "--display off";
        }
        break;
      }

      case "track": {

        if (config_s.track_on) {
          cmd_ = "--track off";
        } else {
          cmd_ = "--track on";
        }
        break;
      }

      case "button": {

        if (config_s.button_on) {
          cmd_ = "--button off";
        } else {
          cmd_ = "--button on";
        }
        break;
      }

      case "posdebug": {

        cmd_ = "--pos";
        break;
      }

      case "wx": {

        cmd_ = "--wx";
        break;
      }

      case "txpwr": {

        let pwr = 0;

        cmd_ = "--txpower " + tx_pwr.current.toString();

        break;
      }

      case "reboot": {

        cmd_ = "--reboot now";
        break;
      }

      case "atxt": {
        console.log("APRS Comment assembled");
        const cmt_txt = aprsCmtRef.current!.value;
        if (cmt_txt) {
          const cmt_str = cmt_txt.toString();
          console.log("APRS Cmt Len: " + cmt_str.length);
          const cmt_str_ = cmt_str.trim();
          console.log("APRS Cmt Len trimmed: " + cmt_str_.length);
          console.log("APRS Comment: " + cmt_str_);
          if (cmt_str_.length > 1) {
            console.log("APRS CMD: " + cmt_str_);
            cmd_ = "--atxt " + cmt_str_;
            aprsCmtRef.current!.value = "";
          }
        }
        break;
      }

      case "txpos": {
        // check if txpos was sent in the last 10 seconds
        const now = Date.now();
        console.log("TX POS pressed at: " + now);
        const diff = now - txpos_last.current;
        console.log("TX POS Diff: " + diff);

        if (diff >= minWaitTime_txpos) {
          cmd_ = "--sendpos";
          txpos_last.current = Date.now();
        } else {
          setAlHeader("TXPOS already sent!");
          setAlMsg("TX POS only every " + minWaitTime_txpos / 1000 + " sec possible!");
          setShAlertCard(true);
        }
        break;
      }

      case "txtrack": {
        // check if txpos was sent in the last 10 seconds and track is on
        const now = Date.now();
        const diff = now - txpos_last.current;
        console.log("TXTRACK Diff: " + diff);

        if (diff >= minWaitTime_txpos) {
          cmd_ = "--sendtrack";
          txpos_last.current = Date.now();
        }
        else {
          setAlHeader("TXTRACK already sent!");
          setAlMsg("TXTRACK only every " + minWaitTime_txpos / 1000 + " sec possible!");
          setShAlertCard(true);
        }
        break;
      }

      // onewire on / off
      case "owon": {
        if (config_s.onewire_on) {
          cmd_ = "--onewire off";
        } else {
          cmd_ = "--onewire on";
        }
        break;
      }

      // set one wire pin
      case "owpin": {
        console.log("Setting Onewire Pin!");

        // if the client is RAK4631 check if pin is in range 0-7 except pin 2 which is powering the sensor baords
        if (config_s.hw === "RAK4631") {
          if (owPinNr.current >= 1 && owPinNr.current <= MAX_PIN_NUM && owPinNr.current !== 2) {
            // set pin
            cmd_ = "--onewire gpio " + owPinNr.current.toString();
          } else {
            owPinNr.current = 4;
            // show alert card
            setAlHeader("Wrong Onewire Pin Number!");
            setAlMsg("Setting Pin to 4!");
            setShAlertCard(true);
          }
        } else {
          // ESP32 check if pin nr is in range and set it if ok
          if (owPinNr.current >= 0 && owPinNr.current <= MAX_PIN_NUM) {
            // set pin
            cmd_ = "--onewire gpio " + owPinNr.current.toString();
          } else {
            // show alert card
            setAlHeader("Wrong Onewire Pin Number!");
            setAlMsg("Pin Nr not in Range!");
            setShAlertCard(true);
          }
        }
        break;
      }

      // LPS33 sensor on / off
      case "lps33": {
        if (config_s.hw === "RAK4631") {
          if (config_s.lps33_on) {
            cmd_ = "--lps33 off";
          } else {
            cmd_ = "--lps33 on";
          }
        } else {
          setAlHeader("LPS33 not supported!");
          setAlMsg("Only on RAK4631 available!");
          setShAlertCard(true);
        }
        break;
      }

      // UTC Offset
      case "utcoffset": {
        console.log("UTC Offset: " + node_utc_offset.current);
        cmd_ = "--utcoff " + node_utc_offset.current.toString();
        /*addMsgQueue(cmd_);
        addMsgQueue("--pos");
        cmd_ = "";*/
        break;
      }

      // scan i2c bus
      case "scani2c": {
        cmd_ = "--showi2c";
        break;
      }

      // mesh on/off if off the node sends no msgs in the mesh back
      case "mesh_retrx": {
        
        if (config_s.mesh_on) {
          cmd_ = "--mesh off";
        } else {
          cmd_ = "--mesh on";
        }
        
        break;
      }

      //webserver on/off
      case "websrv": {
        if (nodeSettings.WS) {
          cmd_ = "--webserver off";
        } else {
          cmd_ = "--webserver on";
        }
        break;
      }

      // country setting
      case "ctry": {
        if (ctry_setting_changed_str.current !== "" && ctry_setting_changed_str.current !== " ") {
          cmd_ = "--setctry " + ctry_setting_changed_str.current;
        }
        break;
      }

      // group settings
      case "setGroup": {
        if (setGrpCmd.current !== "") {
          cmd_ = setGrpCmd.current;
        }
        break;
      }

      // set Wifi-AP Mode
      case "wifi_ap": {
        if (!nodeSettings.GW) {
          if (wifiSettings_s.AP) {
            cmd_ = "--wifiap off";
          }
          else {
            cmd_ = "--wifiap on";
          }
        } else {
          setAlHeader("Gateway Mode active!");
          setAlMsg("Wifi AP Mode not possible!");
          setShAlertCard(true);
        }
        break;
      }

      // gateway no-pos mode
      case "gw_nopos": {
        if(nodeSettings.GWNPOS){
          cmd_ = "--gateway pos";
        }
        else {
          cmd_ = "--gateway nopos";
        }
        break;
      }

      // change into safeboot OTA mode
      case "otaupdate": {
        cmd_ = "--ota-update";
        setAlHeader("Booting into OTA Mode!");
        setAlMsg("On active Wifi connection access it after reboot via Web-Browser with " + nodeInfo_s.CALL + ".local or "+ wifiSettings_s.IP +" if in AP Mode: IP:192.168.4.1 or Meshcom-OTA.local");
        setShAlertCard(true);
        break;
      }

      case "no_allmsg_rx": {
        if(nodeSettings.NOALL){
          cmd_ = "--nomsgall off";
        } else {
          cmd_ = "--nomsgall on";
        }
        break;
      }

      case "userButtonPin": {
        cmd_ = "--button gpio " + userBtnNr.current.toString();
        break;
      }

      // custom ble paring pin
      case "btcode": {
        cmd_ = "--btcode " + ble_pairing_pin.current;
        break;
      }

      // rx boost is only available on boards with a SX126x chip
      case "rxboost": {
        if (config_s.hw === "TBEAM V1.1 1268" || config_s.hw === "TBEAM V1.2 1262" || config_s.hw === "EBYTE E22" || config_s.hw === "HELTEC V3" || config_s.hw === "HELTEC E290" || config_s.hw === "TBEAM Supreme L76K" || config_s.hw === "ESP32-S3 Ebyte") {
          if (nodeInfo_s.BOOST) {
            cmd_ = "--setboostedgain off";
          } else {
            cmd_ = "--setboostedgain on";
          }
        } else {
          setAlHeader("RX Boost not supported!");
          setAlMsg("Only on SX126x Lora chip boards available!");
          setShAlertCard(true);
        }
        break;
      }

    }

    // finally send it via textmsg
    sendTxtCmdNode(cmd_);
    LogS.log(0,"Settings Command: " + cmd_);

    // forward to info page when pos or wx info button pressed
    if (cmd === "posdebug" || cmd === "wx") {
      history.push('/info');
    }
  }



  // set flag that we have new callsign to send to node
  const callChanged = (event: any) => {
    console.log("Call Input changed");
    call_changed.current = true;
  }


  // set flag that we have new aprs symbols to send to node
  const wifiChanged = (event: any) => {
    console.log("Wifi changed");
    wifi_changed.current = true;
  }



  // flag that aprs comment changed in input field
  const cmtChanged = (event: any) => {
    aprs_cmt_changed.current = true;
    console.log("Aprs Comment changed");
  }


  
  // create a function to get the value of the APRS Symbol IonSelect. Event is Symbol Preset Name
  const aprsSymChanged = (event: string) => {
    console.log("Aprs Sym changed");
    console.log("Aprs Sym Name: " + event);
    // get the symbol char and group char from the aprs symbol table
    aprs_symbols_mapped.current.find((item) => {
      if(item.s_name === event){
        console.log("Aprs Sym Char: " + item.s_char);
        console.log("Aprs Sym Group: " + item.s_group);
        aprs_sym_char.current = item.s_char;
        aprs_pri_sec_char.current = item.s_group;
      }});

    AprsSettingsStore.update(s => {
      s.aprsSettings.SYMCD = aprs_sym_char.current;
      s.aprsSettings.SYMID = aprs_pri_sec_char.current;
    });
    
    aprsSym_changed.current = true;
    aprs_pri_sec_valid.current = true;
    aprssym_valid.current = true;
  }


  // set the aprsSym changed flag when characters manual changed
  const aprsSymChangedManual = (event: any) => {
    console.log("Aprs Sym manual changed");

    if(event.target.value != null && event.target.value !== undefined && event.target.value !== "" && event.target.value !== " " && event.target.value.length === 1){
      const char:string = event.target.value;
      console.log("Aprs Sym Char: " + char);
      aprsSym_changed.current = true;
      // allowed values are from ! to }
      if(char.charCodeAt(0) >= 33 && char.charCodeAt(0) <= 125){
        console.log("Aprs Sym Char allowed: " + char);
        aprs_sym_char.current = char;
        aprssym_valid.current = true;
      } else {
        console.log("Aprs Sym Char not allowed!");
        aprssym_valid.current = false;
        return;
      }
    }
  }

  // set the aprsPriSec changed flag when characters manual changed
  const aprsPriSecChangedManual = (event: any) => {
    console.log("Aprs Pri/Sec manual changed");

    if(event.target.value != null && event.target.value !== undefined && event.target.value !== "" && event.target.value !== " " && event.target.value.length === 1){
      const char:string = event.target.value;
      console.log("Aprs Pri/Sec Char: " + char);
      aprsSym_changed.current = true;
      // allowed values are 0-9, A-Z, / and \
      if(char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57 || char.charCodeAt(0) >= 65 && char.charCodeAt(0) <= 90 || char.charCodeAt(0) === 47 || char.charCodeAt(0) === 92){
        console.log("Aprs Pri/Sec Char allowed: " + char);
        aprs_pri_sec_char.current = char;
        aprs_pri_sec_valid.current = true;
      } else {
        console.log("Aprs Pri/Sec Char not allowed!");
        aprs_pri_sec_valid.current = false;
        return;
      }
    }
  }


  // Group Settings
  // If the group setting menu is not open, the Refs are not working
  // set each group and check if it is a number and maximum 5 digits
  // first make a function to check for valid number
  const checkGrpInput = (grp_value:string | number | null | undefined):number => {
    if(grp_value !== null && grp_value !== undefined && grp_value !== "" && grp_value !== " "){
      // check if the value is a number
      const grp_val_nr = +grp_value;
      if(!isNaN(grp_val_nr)){
        // check if the group number has maximum 5 digits
        if(grp_val_nr >= 0 && grp_val_nr <= 99999){
          return grp_val_nr;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    }
    return 0;
  }

  const grp0Changed = (event: any) => {
    const grp0 = event.target.value;
    if(grp0 !== null && grp0 !== undefined && grp0 !== "" && grp0 !== " "){
      console.log("Group 0 changed: " + grp0);
      gcb0Ref.current = checkGrpInput(grp0);
      console.log("Group 0 nr: " + gcb0Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp1Changed = (event: any) => {
    const grp1 = event.target.value;
    if(grp1 !== null && grp1 !== undefined && grp1 !== "" && grp1 !== " "){
      console.log("Group 1 changed: " + grp1);
      gcb1Ref.current = checkGrpInput(grp1);
      console.log("Group 1 nr: " + gcb1Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp2Changed = (event: any) => {
    const grp2 = event.target.value;
    if(grp2 !== null && grp2 !== undefined && grp2 !== "" && grp2 !== " "){
      console.log("Group 2 changed: " + grp2);
      gcb2Ref.current = checkGrpInput(grp2);
      console.log("Group 2 nr: " + gcb2Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp3Changed = (event: any) => {
    const grp3 = event.target.value;
    if(grp3 !== null && grp3 !== undefined && grp3 !== "" && grp3 !== " "){
      console.log("Group 3 changed: " + grp3);
      gcb3Ref.current = checkGrpInput(grp3);
      console.log("Group 3 nr: " + gcb3Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp4Changed = (event: any) => {
    const grp4 = event.target.value;
    if(grp4 !== null && grp4 !== undefined && grp4 !== "" && grp4 !== " "){
      console.log("Group 4 changed: " + grp4);
      gcb4Ref.current = checkGrpInput(grp4);
      console.log("Group 4 nr: " + gcb4Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp5Changed = (event: any) => {
    const grp5 = event.target.value;
    if(grp5 !== null && grp5 !== undefined && grp5 !== "" && grp5 !== " "){
      console.log("Group 5 changed: " + grp5);
      gcb5Ref.current = checkGrpInput(grp5);
      console.log("Group 5 nr: " + gcb5Ref.current);
      groupSettingChanged.current = true;
    }
  }
  



  // save settings at node flash
  const saveSettings = () => {

    console.log("Saving Settings");

    if(call_changed.current){
      console.log("Call changed");
      if(!setCallSign()) {
        setAlHeader("Invalid Callsign Setting!");
        setAlMsg("Please check Callsign! Should be like: OE1XYZ-1 (CLIENT) or OE1XYZ-12 (GATEWAY)");
        setShAlertCard(true);
        return;
      } else {
        sleep(400);
      }
    }

    if(wifi_changed.current){
      console.log("Wifi changed");
      sleep(400).then(() => {
        setWifiSetting();
      });
    }

    if(aprsSym_changed.current){
      console.log("Aprs Sym changed");
      aprsSym_changed.current = false;

      if(aprs_pri_sec_valid.current && aprssym_valid.current){
        sleep(400).then(() => {
          setAprsSymbols();
        });
      } else {
        console.log("Aprs Sym or Pri/Sec not valid!");
        setAlHeader("Invalid APRS Symbol!");
        setAlMsg("Group Char must be 0-9, A-Z, / and \\. Symbol Char must be ! to }");
        setShAlertCard(true);
        return;
      }
    }

    // when cmtChanged send it to node
    if(aprs_cmt_changed.current){
      console.log("Sending APRS Comment to Node");
      aprs_cmt_changed.current = false;
      sleep(400).then(() => {
        sendTxtCmd("atxt");
      });
    } 

    // when node_utc_offset_changed send it to node
    if(node_utc_offset_changed.current){
      console.log("Sending UTC Offset to Node");
      node_utc_offset_changed.current = false;
      sleep(400).then(() => {
        sendTxtCmd("utcoffset");
      });
    }

    // set the country setting to the node
    if(ctry_setting_changed.current){
      console.log("Setting Country to Node");
      ctry_setting_changed.current = false;
      sleep(400).then(() => {
        sendTxtCmd("ctry");
      });
    }

    // GROUP SETTINGS
    // check if group settings changed and send them to node
    if (groupSettingChanged.current) {
      groupSettingChanged.current = false;

      console.log("Group Settings changed");
      console.log("Group 0: " + gcb0Ref.current);
      console.log("Group 1: " + gcb1Ref.current);
      console.log("Group 2: " + gcb2Ref.current); 
      console.log("Group 3: " + gcb3Ref.current);
      console.log("Group 4: " + gcb4Ref.current);
      console.log("Group 5: " + gcb5Ref.current);

      let cmd_str = "--setgrc ";
      cmd_str = cmd_str + gcb0Ref.current.toString() + ";" + gcb1Ref.current.toString() + ";" + gcb2Ref.current.toString() + ";" + gcb3Ref.current.toString() + ";" + gcb4Ref.current.toString() + ";" + gcb5Ref.current.toString() + ";";

      console.log("Group CMD: " + cmd_str);
      setGrpCmd.current = cmd_str;
      sleep(400).then(() => {
        console.log("Time in ms: " + Date.now());
        sendTxtCmd("setGroup");
      });
    }

    // set the userbutton pin to the node
    if(userBtnChanged.current){
      console.log("Setting Userbutton Pin to Node");
      userBtnChanged.current = false;
      sleep(400).then(() => {
        console.log("Time in ms: " + Date.now());
        sendTxtCmd("userButtonPin");
      });
    }

    // custom BLE Pairing Pin
    if(ble_pairing_pin_changed.current){
      console.log("Setting BLE Pairing Pin to Node");
      console.log("Custom BLE Pairing Pin: " + ble_pairing_pin.current);
      ble_pairing_pin_changed.current = false;

      if (ble_pairing_pin.current.length === 6) {
        sleep(400).then(() => {
          sendTxtCmd("btcode");
        });
      } else {
        setAlHeader("Wrong Custom Pin Number!");
        setAlMsg("Pin Nr must have 6 digits!");
        setShAlertCard(true);
        return;
      }
    }

    // set onewire pin
    if (owPinChanged.current) {
      console.log("Onewire Pin changed");
      owPinChanged.current = false;
      sleep(400).then(() => {
        console.log("Time in ms: " + Date.now());
        sendTxtCmd("owpin");
      });
    }


    // send save settings command only when call_changed or wifi_changed - will reboot the client
    if (call_changed.current || wifi_changed.current) {
      sleep(1000).then(() => {
        console.log("Saving Settings and reboot client");

        call_changed.current = false;
        wifi_changed.current = false;

        // reset command for client
        let save_buffer = new ArrayBuffer(2);
        let view1 = new DataView(save_buffer);
        view1.setUint8(0, 2);
        view1.setUint8(1, 0xF0);

        sendDV(view1, devID_s);
      });
    }

    // tell the user that settings are saved. This overwrites cards from before.
    setAlHeader("Settings saved!");
    setAlMsg("In some cases node reboots in 15s!");
    setShAlertCard(true);

    
  }


  // load CSS for the Action Sheet
  const customActionSheetOptions = {
    cssClass: "settings-actionsheet"
  };


  // scroll to bottom when ext settings active
  const scrollToBottom= async ()=>{
    document.getElementById('setting_bottom')!.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }


  // scroll to bottom when ext settings active
  useEffect(()=>{

    if(shAdvSetting)
      scrollToBottom();

  },[shAdvSetting]);


  // tx power setting handler
  useEffect(() => {
    if(txpower_slider){
      console.log("Tx-Power (dBm): " + txpower_slider);

      let newTxPower = +txpower_slider!.toString();
      // if we have old SX127x Chips 18 and 19 dBm are not available
      if(config_s.hw === "TLORA V2" || config_s.hw === "TLORA V2.1.6" || config_s.hw === "TBEAM V1.1" || config_s.hw === "HELTEC V2.1" || config_s.hw === "TBEAM V1.2"){
        if(newTxPower === 18 || newTxPower === 19){
          newTxPower = 17;
        }
      }

      tx_pwr.current = newTxPower; 
      const pwr_exp_w = (newTxPower - 30) / 10;
      const pwr_w = (Math.pow(10, pwr_exp_w) * 1000).toFixed(0); //mW
      console.log("TX Pwr (mW): " + pwr_w);
      setTxPwrW(+pwr_w);
      sendTxtCmd("txpwr");
    }
  }, [txpower_slider]);


  // handle onewire pin setting
  const setOnewire_pin = (event:string) => {

    console.log("Onewire Pin changed!");
    console.log("Event Pin: " + event);

    // check if value from input is not undefined or null
    if (owPinInputRef.current!.value !== undefined && owPinInputRef.current!.value !== null) {
      const pin_str = owPinInputRef.current!.value.toString();
      const pin_nr = +pin_str;

      console.log("Onewire Pin: " + pin_nr);

      if (pin_nr >= 0 && pin_nr <= MAX_PIN_NUM) {

        if (pin_nr !== owPinNr.current) {
          owPinNr.current = pin_nr;
          owPinChanged.current = true;
        }
      }
    }
  }


  // handle userbutton pin setting
  const setUserbutton_pin = (event:string) => {

    console.log("Userbutton Pin changed!");
    console.log("Event Pin: " + event);

    // check if value from input is not undefined or null
    if (userBtnInputRef.current!.value !== undefined && userBtnInputRef.current!.value !== null) {
      const pin_str = userBtnInputRef.current!.value.toString();
      const pin_nr = +pin_str;

      console.log("Userbutton Pin: " + pin_nr);

      if (pin_nr >= 0 && pin_nr <= MAX_USER_BTN_NUM) {

        if (pin_nr !== userBtnNr.current) {
          userBtnNr.current = pin_nr;
          userBtnChanged.current = true;
        }
      } else {
        userBtnChanged.current = false;
        setAlHeader("Wrong Userbutton Pin Number!");
        setAlMsg("Pin Nr not in Range!");
        setShAlertCard(true);
      }
    }
  }


  // handle custom pairing pin setting
  const setBLEParingPin = (event:string) => {

    console.log("Custom BLE Pairing Pin changed!");
    console.log("Event Pin: " + event);
    if(ble_pairing_pin_ref.current!.value !== undefined && ble_pairing_pin_ref.current!.value !== null){
      ble_pairing_pin.current = ble_pairing_pin_ref.current!.value.toString();
    }
    ble_pairing_pin_changed.current = true;
  }

  
  // handle utc offset setting
  const setNodeUTCoffSet = (event:string) => {

    console.log("UTC Offset changed!");
    console.log("Event Offset: " + event);

    // check if value from input is not undefined or null
    if (node_utc_offset_ref.current!.value !== undefined && node_utc_offset_ref.current!.value !== null) {

      const offset_str = node_utc_offset_ref.current!.value.toString();
      const offset_nr = +offset_str;

      // TODO: check if the offset is +/-14 max or > 28 and fire alert card if needed
      if (offset_nr >= -15 && offset_nr <= 30) {

        if (offset_nr !== node_utc_offset.current) {
          node_utc_offset.current = offset_nr;
          node_utc_offset_changed.current = true;
        }
      }

      console.log("UTC Offset: " + offset_nr);
    }
  }


  // open an Alert Card if ScanI2C changed
  useEffect(() => {
      if (scanResult.length > 0) {
        setAlHeader("Scan I2C Bus");
        setAlMsg(scanResult);
        setShAlertCard(true);
      }
  }, [scanResult]);


  // handle Frequency Preset Selection
  const freqPresetChanged = (event: string) => {

    console.log("Freq Preset changed");
    const freq_preset = +event;
    console.log("Freq Preset: " + freq_preset);

    if (freq_preset !== 0) {
      // set frequency
      
    }
  }


  // handle Bandwidth Preset Selection
  const bwPresetChanged = (event: string) => {

    console.log("BW Preset changed");
    const bw_preset = +event;
    console.log("BW Preset: " + bw_preset);

    if (bw_preset !== 0) {
      // set bandwidth
    }
  }


  // handle clear positions - we want to get own position from node afterwords
  const deletePositions = () => {
    console.log("Delete Positions");
    DataBaseService.clearPositions().then(() => {
      console.log("Request own position from node");
      // wait a bit and request own position from node
      setTimeout(() => {
        sendTxtCmdNode("--pos");
      }, 1000);
    });
  }


  // redirect to connect page if unset node
  const redirectConnect = () => {
    setShDiscoCard(false);
    if (isAppActive)
      history.push("/connect");
  }


  // handle OTA Update Button
  const handleOTAUpdate = () => {
    setShOTAUpdateCard(true);
  }




  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Node Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Node Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <AlertCard
          isOpen={shAlertCard}
          header={alHeader}
          message={alMsg}
          onDismiss={() => setShAlertCard(false)}
        />

        <IonAlert
          isOpen={shDiscoCard}
          onDidDismiss={() => redirectConnect()}
          header="BLE Disconnect"
          message="Node disconnected! Auto-Reconnect is disabled currently."
          buttons={[
            {
              text: "OK"
            },
          ]}
        />

        <IonAlert
          isOpen={shRebootCard}
          header="Reboot Node?"
          message="Reboot Node now?"
          buttons={[
            {
              text: 'Cancel',
              handler: () => {
                console.log('Reboot canceled');
                setShRebootCard(false);
              },
            },
            {
              text: 'YES',
              handler: () => {
                console.log('Reboot Node confirmed');
                setShRebootCard(false);
                sendTxtCmd("reboot");
              },
            },
          ]}
        />

        <IonAlert
          isOpen={shOTAUpdateCard}
          header="OTA Update?"
          message="Boot into OTA Mode now?"
          buttons={[
            {
              text: 'Cancel',
              handler: () => {
                console.log('Reboot canceled');
                setShOTAUpdateCard(false);
              },
            },
            {
              text: 'YES',
              handler: () => {
                console.log('Booting to OTA confirmed');
                setShOTAUpdateCard(false);
                sendTxtCmd("otaupdate");
              },
            },
          ]}
        />

        <div id="page">
          <div id="spacer-top" />
          <div className='settings_panel'>
            <div className='sp_header'>
              <div>{config_s.callSign}</div>
            </div>

            <div className='settings_cont'>
              <div className='set_val'>QRG: {config_s.frequency} MHz</div>
              <div className='set_val'>TX Pwr: {nodeSettings.TXP} dBm</div>
            </div>
            <div className='settings_cont'>
              <div>APRS Symbol ID: {aprs_settings_s.SYMID}</div>
              <div>APRS Symbol: {aprs_settings_s.SYMCD}</div>
              <div>APRS Comment: {aprs_cmt_store}</div>
              {aprs_settings_s.NAME.length > 0 && <div>APRS Name: {aprs_settings_s.NAME}</div>}
            </div>

            {(grp0 > 0 || grp1 > 0 || grp2 > 0 || grp3 > 0 || grp4 > 0 || grp5 > 0) && <div className='settings_cont'>
              <div>Call Groups:</div>
              {grp0 > 0 && <div>Group 1: {grp0}</div>}
              {grp1 > 0 && <div>Group 2: {grp1}</div>}
              {grp2 > 0 && <div>Group 3: {grp2}</div>}
              {grp3 > 0 && <div>Group 4: {grp3}</div>}
              {grp4 > 0 && <div>Group 5: {grp4}</div>}
              {grp5 > 0 && <div>Group 6: {grp5}</div>}
            </div>
            }

            <div className='settings_cont'>
              {config_s.hw != "RAK4631" ? <>
              <div>Wifi SSID: {wifiSettings_s.SSID}</div>
              <div>Wifi IP: {wifiSettings_s.IP}</div>
              <div>Wifi GW: {wifiSettings_s.GW}</div>
              <div>Wifi SNM: {wifiSettings_s.SUB}</div>
              </>:<> 
              <div>ETH IP: {wifiSettings_s.IP}</div>
              <div>ETH GW: {wifiSettings_s.GW}</div>
              <div>ETH SNM: {wifiSettings_s.SUB}</div>
              </>}
              
            </div>
          </div>

          <div id="spacer-buttons" />
          <div className='setting_wrapper'>

          <IonItem>
            <IonInput onIonChange={event=>callChanged(event)} ref={callInputRef} label='Set Node Callsign' labelPlacement="floating" placeholder="eg. OE1KFR-1" type='text' maxlength={12}></IonInput>
          </IonItem>
          </div>

          <div id="spacer-buttons" />
          <IonButton id="settings_button" fill='outline' slot='start' onClick={() => shPosOkCard()}>Set Location - Phone GPS</IonButton>

          <div id="spacer-buttons" />
          <div className='setting_wrapper'>

            <IonText id="wifi-text">WiFi Settings</IonText><br /><br />
            <IonItem>
              <IonInput onIonChange={event => wifiChanged(event)} ref={ssidInputRef} label='Set WiFi SSID' labelPlacement="floating" placeholder='SSID' type='text' maxlength={MAX_SSID_CHARS}></IonInput>
            </IonItem>
            <IonItem>
              <IonInput ref={wifipwdInputRef} label='Set WiFi Password' labelPlacement="floating" placeholder='PWD' type={shWifiPwd ? 'text':'password'} maxlength={MAX_PWD_CHARS}></IonInput>
              <IonIcon slot='end' icon={shWifiPwd ? eyeOffOutline : eyeOutline} onClick={() => setShWifiPwd(!shWifiPwd)}></IonIcon>
            </IonItem>
          </div>

          <div id="spacer-buttons" />

          <div className='setting_wrapper'>
            <IonText id="wifi-text">APRS Settings</IonText><br />

            <div className='mt-3 mb-3'>APRS Map Symbol Preset:</div>

            <div id="spacer-toggle" />
            <IonItem>
              <IonSelect interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="APRS Symbol" onIonChange={(ev) => aprsSymChanged(ev.detail.value)}>
                {aprs_symbols_mapped.current.map((sym) => (
                  <IonSelectOption key={sym.s_name} value={sym.s_name}>
                    {sym.s_name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <div className='mt-3 mb-3'>Symbol Group Char</div>
            <IonItem>
              <IonInput value={aprs_settings_s.SYMID} ref={aprs_pri_sec_char_Input_ref} onIonInput={(ev) => aprsPriSecChangedManual(ev)} label='Set Group Character' labelPlacement="floating" type='text' maxlength={1}></IonInput>
            </IonItem>
            <div className='mt-3 mb-3'>Symbol Char</div>
            <IonItem>
              <IonInput value={aprs_settings_s.SYMCD} ref={aprs_sym_char_Input_ref} onIonInput={(ev) => aprsSymChangedManual(ev)} label='Set Character' labelPlacement="floating" type='text' maxlength={1}></IonInput>
            </IonItem>

            <div className='mt-3 mb-3'>APRS Comment:</div>

            <IonItem>
              <IonInput onInput={(event) => cmtChanged(event)} ref={aprsCmtRef} label='Set Comment' labelPlacement="floating" type='text' maxlength={MAX_APRS_CMT_CHARS}></IonInput>
            </IonItem>
          </div>

          <div id="spacer-buttons" />
          <div className='setting_wrapper'>
            <IonText id="wifi-text">Onewire Pin</IonText>
            <div className='mb-3'></div>
            <IonItem>
              <IonInput value={owPinNr.current} ref={owPinInputRef} label='Set Onewire Pin' labelPlacement="floating" type='number' maxlength={2} inputmode="numeric" onIonInput={(ev) => setOnewire_pin(ev.detail.value!)}></IonInput>
            </IonItem>
          </div>

          <div id="spacer-buttons" />
          <div className='setting_wrapper'>
            <IonText id="wifi-text">Userbutton Pin</IonText>
            <div className='mb-3'></div>
            <IonItem>
              <IonInput value={userBtnNr.current} ref={userBtnInputRef} label='Set Userbutton Pin' labelPlacement="floating" type='number' maxlength={2} inputmode="numeric" onIonInput={(ev) => setUserbutton_pin(ev.detail.value!)}></IonInput>
            </IonItem>
          </div>

          {/*<div id="spacer-buttons" />
          <div className='setting_wrapper'>
            <IonText id="wifi-text">Custom BLE PIN 6 Digits</IonText>
            <div className='mb-3'></div>
            <IonItem>
              <IonInput value={ble_pairing_pin.current} ref={ble_pairing_pin_ref} label='Set BLE Pin' labelPlacement="floating" type='number' maxlength={6} inputmode="numeric" onIonInput={(ev) => setBLEParingPin(ev.detail.value!)}></IonInput>
            </IonItem>
          </div>*/}

          <div id="spacer-buttons" />
          <div className='setting_wrapper'>
            <IonText id="wifi-text">Node UTC Time-Offset</IonText>
            <div className='mb-3'></div>
            <IonItem>
              <IonInput value={node_utc_offset.current} ref={node_utc_offset_ref} label='Set UTC Offset' labelPlacement="floating" type='number' maxlength={2} onIonInput={(ev) => setNodeUTCoffSet(ev.detail.value!)}></IonInput>
            </IonItem>
          </div>

          <div id="spacer-buttons" />
          <div className='dropdown_arrow'>
            <div className='dropdown_arrow_header'>
              <div id="advIcon">
                <IonIcon icon={shCtrySetting ? chevronDown : chevronForward} id="advIcon" color="primary" onClick={() => setShCtrySetting(!shCtrySetting)} />
              </div>
              <IonText>Country Setting</IonText>
            </div>
            {shCtrySetting && 
              <IonItem>
              <IonSelect value={ctrySetting} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Country" onIonChange={(ev) => setCtryNode(ev.detail.value)}>
                {ctry_list.map((ctry) => (
                  <IonSelectOption key={ctry} value={ctry}>
                    {ctry_list_translated[ctry]}
                  </IonSelectOption>
                ))}
              </IonSelect><br></br>
            </IonItem>
            }
          </div>

          <div id="spacer-buttons" />
          <div className='dropdown_arrow'>
            <div className='dropdown_arrow_header'>
              <div id="advIcon">
                <IonIcon icon={shGroupCallSet ? chevronDown : chevronForward} id="advIcon" color="primary" onClick={() => setShGroupCallSet(!shGroupCallSet)} />
              </div>
              <IonText>Group Subscription</IonText>
            </div>
            {shGroupCallSet &&
              <div className='setting_wrapper'>
                <div className='mt-3 mb-3'>Group 1</div>
                <IonItem>
                  <IonInput value={grp0} onIonInput={(ev) => grp0Changed(ev)} label='Set Group 1' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='mt-3 mb-3'>Group 2</div>
                <IonItem>
                  <IonInput value={grp1} onIonInput={(ev) => grp1Changed(ev)} label='Set Group 2' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='mt-3 mb-3'>Group 3</div>
                <IonItem>
                  <IonInput value={grp2} onIonInput={(ev) => grp2Changed(ev)} label='Set Group 3' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='mt-3 mb-3'>Group 4</div>
                <IonItem>
                  <IonInput value={grp3} onIonInput={(ev) => grp3Changed(ev)} label='Set Group 4' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='mt-3 mb-3'>Group 5</div>
                <IonItem>
                  <IonInput value={grp4} onIonInput={(ev) => grp4Changed(ev)} label='Set Group 5' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='mt-3 mb-3'>Group 6</div>
                <IonItem>
                  <IonInput value={grp5} onIonInput={(ev) => grp5Changed(ev)} label='Set Group 6' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='resetGrpBtn'>
                    <IonButton fill='solid' slot='start' onClick={() => resetGrpCall()}>Reset Groups</IonButton>
                </div>
              </div>
            }
          </div>

          <div id="spacer-buttons" />
            <IonButton id="settings_button" fill='solid' slot='start' onClick={saveSettings}>Save Settings to Node</IonButton>
          <div id="spacer-buttons" />

          <div className='dropdown_arrow'>
            <div className='dropdown_arrow_header'>
              <div id="advIcon">
                <IonIcon icon={shUserBtns ? chevronDown : chevronForward} id="advIcon" color="primary" onClick={() => setShUserBtns(!shUserBtns)} />
              </div>
              <IonText >User Buttons</IonText>
            </div>
            {shUserBtns ? <>
              <div className='settings_btns'>
                <div className='settings_btns_l'>
                  <div>
                    <IonButton expand="block" fill={nodeSettings.GW ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("gw")}>GATEWAY</IonButton>
                  </div>
                  <div >
                    <IonButton expand="block" fill={nodeSettings.DISP ? 'outline' : 'solid'} slot='start' onClick={() => sendTxtCmd("display")}>DISPLAY</IonButton>
                  </div>
                  <div >
                    <IonButton expand="block" fill={config_s.gps_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("gps")}>GPS</IonButton>
                  </div>
                  <div >
                    <IonButton expand="block" fill={nodeInfo_s.BOOST ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("rxboost")}>RX Gain Boost</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("txpos")}>Send POS</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.bme_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("bme")}>BME280</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.bme680_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("680")}>BME680</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.onewire_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("owon")}>One Wire</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("wx")}>WX-Info</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={nodeSettings.WS ? 'solid' : 'outline'} onClick={() => sendTxtCmd("websrv")}>Webserver</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("scani2c")}>Scan I2C</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => handleOTAUpdate()}>OTA Update</IonButton>
                  </div>
                </div>
                <div className='settings_btns_r'>
                  {/*<div>
                    <IonButton expand="block" fill={nodeSettings.GWNPOS ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("gw_nopos")}>GW NO POS</IonButton>
                  </div>  */}
                  <div>
                    <IonButton expand="block" fill={config_s.mesh_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("mesh_retrx")}>MESH</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={nodeSettings.NOALL ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("no_allmsg_rx")}>No ALL Msg RX</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.button_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("button")}>BUTTON</IonButton>
                  </div>
                  <div >
                    <IonButton expand="block" fill={config_s.track_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("track")}>TRACK</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("txtrack")}>Send TRACK</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.bmp_on? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("bmp")}>BMP280</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.mcu811_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("mcu811")}>MCU-811</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.lps33_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("lps33")}>LPS33</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("posdebug")}>POS-Info</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={wifiSettings_s.AP ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("wifi_ap")}>Wifi AP</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => setShRebootCard(true)}>REBOOT</IonButton>
                  </div>
                </div>
              </div>
            </> : <></>}
          </div>

          

          <div id="spacer-buttons" />

          <div className='dropdown_arrow'>
            <div className='dropdown_arrow_header'>
              <div id="advIcon">
                <IonIcon icon={shTxPwrSlider ? chevronDown : chevronForward} id="advIcon" color="primary" onClick={() => setShTxPwrSlider(!shTxPwrSlider)} />
              </div>
              <IonText >TX-Power</IonText>
            </div>
            {shTxPwrSlider ? <>
              <div className='ionrange_box'>
                <IonRange value={tx_pwr.current} min={minTXpwr.current} max={maxTXpwr.current} pin={true} debounce={350} pinFormatter={(value: number) => `${value} dBm`}
                  onIonChange={({ detail }) => setTxpower_slider(detail.value)}></IonRange>
                <IonLabel>Tx-Pwr: {tx_pwr.current} dBm / {tx_pwr_w}mW</IonLabel>
              </div>
            </> : <></>}
          </div>  

          <div id="spacer-buttons" />

          <div className='dropdown_arrow'>
            <div className='dropdown_arrow_header'>
              <div id="advIcon">
                <IonIcon icon={shAdvSetting ? chevronDown : chevronForward} id="advIcon" color="primary" onClick={() => setshAdvSetting(!shAdvSetting)} />
              </div>
              <IonText >Advanced Settings</IonText>
            </div>
            {shAdvSetting ? <>
              <div id="spacer-advTop" />
              <IonButton id="settings_button" fill='outline' slot='start' onClick={()=>deletePositions()}>Clear received nodes</IonButton>
              <div id="spacer-advTop" />
              <IonButton id="settings_button" fill='outline' slot='start' onClick={()=>DataBaseService.clearTextMessages()}>Clear Text Msgs</IonButton>
              <div id="spacer-advTop" />
              <IonButton id="settings_button" fill='outline' slot='start' onClick={()=>MheardStaticStore.clearMheards()}>Clear Mheards</IonButton>
              {/*<div id="spacer-advTop" />
              <IonButton id="settings_button" fill='outline' slot='start' onClick={()=>DataBaseService.clearAppSettings()}>Clear App Settings</IonButton>*/}

            </> : <></>}
            
          </div>
          <div id="setting_bottom"/>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
