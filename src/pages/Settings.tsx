
import { IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar, IonLabel, IonInput, IonItem, IonButton, IonToggle, IonRange, IonIcon, IonRow, IonCol, IonGrid, IonSelect, IonSelectOption, useIonViewWillEnter, IonAlert, IonProgressBar, useIonViewDidEnter } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import {useBLE} from '../hooks/BleHandler';

import './Settings.css';
import { useStoreState } from 'pullstate';
import { DevIDStore } from '../store';
import { getDevID, getBLEconnStore, getConfigStore, getScanResult } from '../store/Selectors';
import ConfigStore from '../store/ConfStore';
import { ConfType, InfoData, SensorSettings,WifiSettings, NodeSettings, SensorSettingsS1, WifiSettings2, NodeSettingsS1 } from '../utils/AppInterfaces';
import { iosTransitionAnimation, RangeValue } from '@ionic/core';
import { chevronDown, chevronForward, eyeOutline, eyeOffOutline, checkmarkCircle, idCardOutline, wifiOutline, mapOutline, chatboxOutline, pricetagOutline, bluetoothOutline, timeOutline, locationOutline, globeOutline, peopleOutline, toggleOutline, flashOutline, serverOutline, hardwareChipOutline, thermometerOutline, gitNetworkOutline, swapHorizontalOutline, gitBranchOutline, keyOutline, terminalOutline, constructOutline, listOutline } from 'ionicons/icons';
import {aprs_char_table, aprs_pri_symbols} from '../store/AprsSymbols';
import AlertCard from '../components/AlertCard';
import { useNavigate } from "react-router-dom";
import ScanI2CStore from '../store/ScanI2CStore';
import SensorSettingsStore from '../store/SensorSettings';
import BLEconnStore from '../store/BLEconnected';
import DataBaseService from '../DBservices/DataBaseService';
import NodeInfoStore from '../store/NodeInfoStore';
import WifiSettingsStore from '../store/WifiSettings';
import NodeSettingsStore from '../store/NodeSettingsStore';
import LogS from '../utils/LogService';
import AutoReconnectManager from '../utils/AutoReconnectManager';
import { markConnected } from '../utils/ReconnectPersist';
import MheardStaticStore from '../utils/MheardStaticStore';
import AprsSettingsStore from '../store/AprSettingsStore';
import { usePhoneGps } from '../utils/PhoneGps';
import { normalizeCallsignSsid } from '../utils/Callsign';
import { checkIna226, inaNumText, inaSampleLabel, INA_SAMPLES, INA_SHUNT_MIN, INA_SHUNT_MAX, INA_IMAX_MAX } from '../utils/Ina226';
import { checkNetPassword, MAX_NET_PWD_CHARS } from '../utils/NetPassword';
import { checkMaxVoltage, isSingleCellMaxV, MAXV_MIN, MAXV_MAX } from '../utils/MaxVoltage';
import { checkManualCommand, MAX_MANUAL_CMD_BYTES } from '../utils/ManualCommand';
import { TZ_PRESETS, MAX_TZ_CHARS, checkTzRule, findTzPreset } from '../utils/TimeZone';
import WxDataStore from '../store/WxData';
import SensorSettingsS1Store from '../store/SensorSettingsS1';
import WifiSettingsStore2 from '../store/WiFiSettings2';
import NodeSettingsStoreS1 from '../store/NodeSettingsStoreS1';
import GpsDataStore from '../store/GpsData';




const Tab2: React.FC = () => {

  // currently settings are saved when config message comes back from phone

  // BLE TX function
  const {sendDV, sendTxtCmdNode, updateDevID, updateBLEConnected} = useBLE();

  // get the gps functions to set current position
  const {setCurrPosGPS} = usePhoneGps();

  // navigate forward to page
  const navigate = useNavigate();

  // devid from store
  const devID_s = useStoreState(DevIDStore, getDevID);

  //config from sate store
  const config_s:ConfType = useStoreState(ConfigStore, getConfigStore);

  // BLE connected from store
  const ble_connected:boolean = useStoreState(BLEconnStore, getBLEconnStore);

  // wifii settings from store
  const wifiSettings_s:WifiSettings = WifiSettingsStore.useState(s => s.wifiSettings);
  const wifiSettings2_s:WifiSettings2 = WifiSettingsStore2.useState(s => s.wifiSettings2);
  // own NTP server is set on the node (empty or "none" = not set)
  const ownNtpSet = !!wifiSettings2_s.OWNNTP && wifiSettings2_s.OWNNTP.trim() !== "" && wifiSettings2_s.OWNNTP.trim().toLowerCase() !== "none";
  const nodeSettingsS1_s:NodeSettingsS1 = NodeSettingsStoreS1.useState(s => s.nodeSettingsS1);

  // node settings
  const nodeSettings:NodeSettings = useStoreState(NodeSettingsStore, s => s.nodeSettings);

  // sensor settings from store
  const sensorSettings_s:SensorSettings = useStoreState(SensorSettingsStore, s => s.sensorSettings);

  const sensorSettingsS1_s:SensorSettingsS1 = SensorSettingsS1Store.useState(s => s.sensorSettingsS1);

  // aprs settings from store
  const aprs_settings_s = AprsSettingsStore.useState(s => s.aprsSettings);


  // trigger if we have an unconfiuired node
  //const shouldConf = useStoreState(ShouldConfStore, s => s.shouldConf);

  // NodeInfos
  const nodeInfo_s:InfoData = NodeInfoStore.useState(s => s.infoData);

  // weatherdata
  const wxData_s = WxDataStore.useState(s => s.wxData);
  
  // Position Data from store
  const ownPosData = GpsDataStore.useState(s => s.gpsData);





  // remember which setting changed to send it to node
  const aprsSym_changed = useRef<boolean>(false);
  //const aprs_cmt_store = useStoreState(AprsCmtStore, s => s.aprsCmt);


  // references to the server userinput textfields 
  const callInputRef = useRef<HTMLIonInputElement>(null);
  const callSignInputRef = useRef<string>("");
  const ssidInputRef = useRef<HTMLIonInputElement>(null);
  const wifipwdInputRef = useRef<HTMLIonInputElement>(null);
  const aprsCmtRef = useRef<HTMLIonInputElement>(null);
  const ssidWifi_str = useRef<string>("");
  const pwdWifi_str = useRef<string>("");

  // Regex for callsign check
  const regexCallsign = /^([A-Z]{1,3}[0-9]{1,2}[A-Z]{0,3}|[0-9][A-Z][0-9][A-Z]{1,3})-[0-9]{1,2}$/;
  // max length of a callsign incl. SSID (node callsign and via destination callsign)
  const MAX_CALLSIGN_LEN = 11;
  // max length of the web ui password (node_webpwd[20] in firmware, --webpwd cuts at 19)
  const MAX_WEBPWD_LEN = 19;

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

  // tx power settings
  const [txpower_slider, setTxpower_slider] = useState<RangeValue>();
  // SX127x MinPwr: 5, MaxPwr: 17; SX126x MinPwr: -5, MaxPwr: 22; E22 +8db PA
  const minTXpwr = useRef<number>(5);
  const maxTXpwr = useRef<number>(17);
  const tx_pwr = useRef<number>(17);
  const [tx_pwr_w, setTxPwrW] = useState<number>(17);
  const [tx_pwr_pct, setTxPwrPct] = useState<number>(100);
  const [shTxPwrSlider, setShTxPwrSlider] = useState<boolean>(false);

  // reboot node 
  const [shRebootCard, setShRebootCard] = useState<boolean>(false);
  const [shDeepSleepCard, setShDeepSleepCard] = useState<boolean>(false);

  // OTA Update Card Yes/No
  const [shOTAUpdateCard, setShOTAUpdateCard] = useState<boolean>(false);

  // Send POS in TRACK mode without GPS fix: choose LoRa-APRS or MeshCom position
  const [shSendPosChoice, setShSendPosChoice] = useState<boolean>(false);
  const sendPosBusy = useRef<boolean>(false);
  const GPS_FIX_WAIT_MS = 3000;

  // onewire pin ref
  const owPinInputRef = useRef<HTMLIonInputElement>(null);
  const owPinNr = useRef<number>(0);
  let MAX_PIN_NUM = 60;

  // userbutton pin ref
  const userBtnInputRef = useRef<HTMLIonInputElement>(null);
  const userBtnNr = useRef<number>(0);
  let MAX_USER_BTN_NUM = 60;

  // Node UTC Time-Offset setting
  const node_utc_offset = useRef<number>(0);

  // Node time zone (POSIX rule) setting
  // The inputs are state driven: the Ionic React wrapper writes the value prop to the element on every
  // render, a value put there via ref would be overwritten again by the next render.
  const tz_cmd_str = useRef<string>("");
  const [tzText, setTzText] = useState<string>("");
  const [shTimeZone, setShTimeZone] = useState<boolean>(false);
  const [utcText, setUtcText] = useState<string>("");
  // node sends TZ in SN1 only with firmware that knows --settz
  const tzSupported = nodeSettingsS1_s.TZ !== undefined;
  const tzActive = (nodeSettingsS1_s.TZ ?? "") !== "";

  // custom BLE Pairing Ping
  const ble_pairing_pin = useRef<string>("000000");
  const ble_pairing_pin_ref = useRef<HTMLIonInputElement>(null);
  const [ble_pairing_pin_display, setBLEPairingPinDisplay] = useState<string>("000000");

  // show hide user buttons
  const [shUserBtns, setShUserBtns] = useState<boolean>(false);
  const [shSensorSet, setShSensorSet] = useState<boolean>(false);
  // INA226 settings, the node sends them in S1
  const [shIna, setShIna] = useState<boolean>(false);
  const [inaShuntText, setInaShuntText] = useState<string>("");
  const [inaImaxText, setInaImaxText] = useState<string>("");
  const [inaSampSel, setInaSampSel] = useState<number>(0);
  const ina_cmd_str = useRef<string>("");
  // the node sends the INA226 keys in S1 only when its build has the INA226 (otherwise the commands do not exist)
  const inaSupported = sensorSettingsS1_s.TYP === "S1" && Object.prototype.hasOwnProperty.call(sensorSettingsS1_s, "226F");

  // color setting for some buttons
  const [bme680_color, setBme680_color] = useState<string>("primary");
  const [bme280_color, setBme280_color] = useState<string>("primary");
  const [bmp280_color, setBmp280_color] = useState<string>("primary");
  const [bmp3_color, setBmp3_color] = useState<string>("primary");
  const [s811_color, set811_color] = useState<string>("primary");
  const [onewire_color, setOnewire_color] = useState<string>("primary");
  const [aht20_color, setAht20_color] = useState<string>("primary");
  const [sht21_color, setSht21_color] = useState<string>("primary");

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
  const ctry_list = ["EU8", "EA", "UK", "LA", "UK8", "PL", "US", "VR2", "868", "915"];
  const ctry_list_translated: {[key: string]: string} = 
  {"EU8":"EU8 | 433.175MHz",
  "UK":"UK | 439.9125MHz",
  "UK8":"UK8 | 439.9125MHz",
  "PL":"PL | 434.855MHz",
  "US":"US | 433.175MHz", 
  "VR2":"VR2 | 435.775MHz", 
  "868":"868 | 869.525MHz", 
  "915":"915 | 906.875MHz",
  "EA":"EA | 433.175MHz",
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
  const ip_addr_ref = useRef<HTMLIonInputElement>(null);
  const ip_gw_ref = useRef<HTMLIonInputElement>(null);
  const ip_snm_ref = useRef<HTMLIonInputElement>(null);
  const ip_dns_ref = useRef<HTMLIonInputElement>(null);
  const ip_ntp_ref = useRef<HTMLIonInputElement>(null);
  const ip_addr_str =useRef<string>("");
  const ip_gw_str = useRef<string>("");
  const ip_snm_str = useRef<string>("");
  const ip_dns_str = useRef<string>("");
  // optional, empty = --setownntp is not sent
  const ip_ntp_str = useRef<string>("");
  // make the regex simple with 4 octets and each octet is 0-255
  const ip_regex = /^(?!0\d)(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(?!0\d)(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  // show hide the Userbutton Pins Settings
  const [shHwPins, setShHwPins] = useState<boolean>(false);

  // Name Setting
  const name_input_ref = useRef<HTMLIonInputElement>(null);
  const name_str = useRef<string>("");
  const MAX_NAME_CHARS = 15;

  // temperature offset setting
  const temp_offset_ref = useRef<HTMLIonInputElement>(null);
  const temp_offset_str = useRef<string>("");
  const temp_ow_offset_ref = useRef<HTMLIonInputElement>(null);
  const [shTempOffset, setShTempOffset] = useState<boolean>(false);

  // ext. UDP Interface Settings
  const [shExtUdp, setShExtUdp] = useState<boolean>(false);
  const ext_udp_ip_ref = useRef<HTMLIonInputElement>(null);
  const ext_udp_IP_str = useRef<string>("");
  const ext_udp_enable_str = useRef<string>("");

  // Manual Routing (via callsign) Settings
  const [shManRouting, setShManRouting] = useState<boolean>(false);
  const via_call_ref = useRef<HTMLIonInputElement>(null);
  const via_call_str = useRef<string>("");
  const via_enable_str = useRef<string>("");

  // Web UI Password Settings
  const [shWebPwdSect, setShWebPwdSect] = useState<boolean>(false);
  const [shWebPwd, setShWebPwd] = useState<boolean>(false);
  const webpwd_ref = useRef<HTMLIonInputElement>(null);

  // Max Hop, Max Voltage, battery display and MTU. The node reports them in SN1, absent with older firmware.
  const [shMaxHop, setShMaxHop] = useState<boolean>(false);
  const [maxHopSel, setMaxHopSel] = useState<number>(4);
  const [shMaxV, setShMaxV] = useState<boolean>(false);
  const [maxVText, setMaxVText] = useState<string>("");
  const [shBattDisp, setShBattDisp] = useState<boolean>(false);
  const [battDispSel, setBattDispSel] = useState<string>("volt");
  const [shMtu, setShMtu] = useState<boolean>(false);
  const [mtuSel, setMtuSel] = useState<number>(1280);
  const net_cmd_str = useRef<string>("");
  // Remote Netconsole: on/off and the password, which KISS auth uses as well
  const [shNetcon, setShNetcon] = useState<boolean>(false);
  const [netPwdText, setNetPwdText] = useState<string>("");
  const [shNetPwd, setShNetPwd] = useState<boolean>(false);
  // hop values of the firmware web page, plus the current one if it was set outside of them with --maxhop
  const maxHopOptions = [4, 3, 2].concat(nodeSettingsS1_s.MHOP !== undefined && ![4, 3, 2].includes(nodeSettingsS1_s.MHOP) ? [nodeSettingsS1_s.MHOP] : []).sort((a, b) => a - b);
  const mtuOptions = [{ v: 1280, t: "1280 (HAMNET / VPN, default)" }, { v: 1400, t: "1400" }, { v: 1500, t: "1500 (plain LAN)" }]
    .concat(nodeSettingsS1_s.MTU !== undefined && ![1280, 1400, 1500].includes(nodeSettingsS1_s.MTU) ? [{ v: nodeSettingsS1_s.MTU, t: String(nodeSettingsS1_s.MTU) }] : [])
    .sort((a, b) => a.v - b.v);

  useEffect(() => {
    setInaShuntText(inaNumText(sensorSettingsS1_s.SHUNT));
    setInaImaxText(inaNumText(sensorSettingsS1_s.IMAX));
    setInaSampSel(sensorSettingsS1_s.SAMP);
  }, [sensorSettingsS1_s.SHUNT, sensorSettingsS1_s.IMAX, sensorSettingsS1_s.SAMP]);
  useEffect(() => {
    if (nodeSettingsS1_s.MHOP !== undefined) setMaxHopSel(nodeSettingsS1_s.MHOP);
  }, [nodeSettingsS1_s.MHOP]);
  useEffect(() => {
    if (nodeSettingsS1_s.MTU !== undefined) setMtuSel(nodeSettingsS1_s.MTU);
  }, [nodeSettingsS1_s.MTU]);
  useEffect(() => {
    if (nodeSettingsS1_s.VOLT !== undefined) setBattDispSel(nodeSettingsS1_s.VOLT ? "volt" : "proz");
  }, [nodeSettingsS1_s.VOLT]);
  useEffect(() => {
    if (nodeInfo_s.MAXV > 0) setMaxVText(String(nodeInfo_s.MAXV));
  }, [nodeInfo_s.MAXV]);

  // Manual Command section
  const [shManualCmdSect, setShManualCmdSect] = useState<boolean>(false);
  const [manualCmdText, setManualCmdText] = useState<string>("");
  const manual_cmd_str = useRef<string>("");
  const maxv_cmd_val = useRef<number>(0);
  const net_pwd_cmd_val = useRef<string>("");
  const webpwd_str = useRef<string>("");

  // Manual Position Settings Input Refs
  const [shManualPos, setShManualPos] = useState<boolean>(false);
  const manual_lat_ref = useRef<HTMLIonInputElement>(null);
  const manual_lon_ref = useRef<HTMLIonInputElement>(null);
  const manual_alt_ref = useRef<HTMLIonInputElement>(null);
  const manual_pos_cmd = useRef<string>("");

  // Gateway Server Settings and Selection
  const [shGwServerSet, setShGwServerSet] = useState<boolean>(false);
  const gw_srv = NodeSettingsStore.useState(s => s.nodeSettings.GWS);
  const gw_srv_str = useRef<string>("OE");
  const gw_srv_table : {[key: string]: string} = {
    "OE": "Austria-OE",
    "DL": "Germany-DL",
    "IT": "Italy-IT",
    "HC": "Germany Hamnet-HC",
    "HB": "Switzerland-HB",
    "SP": "Poland-SP"};
  const gw_srv_list = Object.keys(gw_srv_table);
  const setGwServerNode = (gw_ev:string) => {
    console.log("Setting Gateway Server: " + gw_ev);
    gw_srv_str.current = gw_ev;
    NodeSettingsStore.update(s => {
      s.nodeSettings.GWS = gw_ev;
    });}

  



  // Tasks we need to do when we enter the page
  useIonViewDidEnter(() => {
    // update the ble devid from pullsate store
    const devid = devID_s;
    updateDevID(devid);
    console.log("Settings Page: Updating DevID " + devid);
    const bleconn = ble_connected;
    console.log("Settings Page BLE connected: " + bleconn);
    updateBLEConnected(bleconn);

  });




  // when config has changed update aprs symbols
  useEffect(()=>{

    console.log("Settings Config changed");
    
    console.log("Call: " + config_s.callSign);
    console.log("Lat: " + config_s.lat);
    console.log("Lon: " + config_s.lon);
    console.log("Alt: " + config_s.alt);
    console.log("Aprs Pri/Sec: " + aprs_pri_sec_char.current);
    console.log("Aprs Symbol: " + aprs_sym_char.current);

  }, [config_s]);


  // setting txpower slider and values if nodesettings arrive
  useEffect(()=>{
    LogS.log(0,"Settings Page NodeSettings updated");
    // set min max power based on hw
    if(nodeInfo_s.HWID === 5 || nodeInfo_s.HWID >= 7 && nodeInfo_s.HWID <= 9 || nodeInfo_s.HWID >= 39) {
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
    const max_pwr_w = Math.pow(10, (maxTXpwr.current - 30) / 10) * 1000;
    setTxPwrPct(Math.round((+pwr_w) / max_pwr_w * 100));

    // set UTC ref
    console.log("Node UTC Offset: " + nodeSettings.UTCOF);
    node_utc_offset.current = nodeSettings.UTCOF;

  },[nodeSettings]);


  // show the rule of the node in the text field
  useEffect(() => {
    setTzText(nodeSettingsS1_s.TZ ?? "");
  }, [nodeSettingsS1_s.TZ]);

  // Fixed offset field: with a rule set the node derives the offset itself, so there is no fixed value then
  useEffect(() => {
    setUtcText(tzActive ? "" : String(nodeSettings.UTCOF));
  }, [nodeSettings.UTCOF, tzActive]);




  // adapt ble pin when nodesettings arrive
  useEffect(()=>{
    LogS.log(0,"BLE Pairing Pin updated from NodeSettings");
    // set the ble pin from info data. Comes in as INT but we need it as string for the input and sending to node
    // Use ?? 0 to handle old firmware that does not send BPIN in the info JSON
    const bpin = nodeInfo_s.BPIN ?? 0;
    let ble_pin_str = bpin.toString();
    // if the ble pin is 0 or 000000 we set it to 000000
    if(bpin === 0 || ble_pin_str === "000000"){
      ble_pairing_pin.current = "000000";
      setBLEPairingPinDisplay("000000");
    } else {
      // if the ble pin is less than 6 digits we add leading zeros
      if(ble_pin_str.length < 6){
        ble_pin_str = ble_pin_str.padStart(6, "0");
      }

      ble_pairing_pin.current = ble_pin_str;
      setBLEPairingPinDisplay(ble_pin_str);
    }
  },[nodeInfo_s.BPIN]);


  

  // set values of sensor settings when they arrive
  useEffect(()=>{
    LogS.log(0,"Settings Page SensorSettings updated");
    // set userbutton pin number from sensor settings
    userBtnNr.current = sensorSettings_s.USERPIN;
    // set onewire pin number from config
    owPinNr.current = sensorSettings_s.OWPIN;

    // set bme680 color based on sensor settings
    if(sensorSettings_s['680F'] && sensorSettings_s[680] || !sensorSettings_s[680]){
      setBme680_color("primary");
    } else {
      setBme680_color("danger");
    }
    // set bme280 color based on sensor settings
    if(sensorSettings_s.BME && sensorSettings_s.BMXF || !sensorSettings_s.BME){
      setBme280_color("primary");
    } else {
      setBme280_color("danger");
    }
    // set bmp280 color based on sensor settings
    if(sensorSettings_s.BMP && sensorSettings_s.BMXF || !sensorSettings_s.BMP){
      setBmp280_color("primary");
    } else {
      setBmp280_color("danger");
    }
    // set bmp3 color based on sensor settings
    if(sensorSettings_s.BMP3 && sensorSettings_s.BMP3F || !sensorSettings_s.BMP3){
      setBmp3_color("primary");
    } else {
      setBmp3_color("danger");
    }
    // set s811 color based on sensor settings
    if(sensorSettings_s['811F'] && sensorSettings_s['811'] || !sensorSettings_s['811']){
      set811_color("primary");
    } else {
      set811_color("danger");
    }
    // set onewire color based on sensor settings
    if(sensorSettings_s.OW && sensorSettings_s.OWF || !sensorSettings_s.OW){
      setOnewire_color("primary");
    } else {
      setOnewire_color("danger");
    } 
    // set aht20 color based on sensor settings
    if(sensorSettings_s.AHT && sensorSettings_s.AHTF || !sensorSettings_s.AHT){
      setAht20_color("primary");
    } else {
      setAht20_color("danger");
    }
    // set sht21 color based on sensor settings
    if(sensorSettingsS1_s.SHT && sensorSettingsS1_s.SHTF || !sensorSettingsS1_s.SHT){
      setSht21_color("primary");
    } else {
      setSht21_color("danger");
    }

  },[sensorSettings_s, sensorSettingsS1_s]);




  // sleep function for delay
  const sleep = (ms:number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  //send config to phone - we send a string with delimeter Config starts with "C:" 
  /**
  * 
  * Config Messages:
  * length 1B - Msg ID 1B - Data
  * 
   * Msg ID:
   * 0x10 - Hello Message (followed by 0x20, 0x30)
   * 0x20 - Timestamp from phone
   * 0x50 - Callsign - DEPRECATED
   * 0x55 - Wifi SSID and PW - DEPRECATED
   * 0x70 - Latitude - DEPRECATED
   * 0x80 - Longitude - DEPRECATED
   * 0x90 - Altitude - DEPRECATED
   * 0xA0 - Textmessage
   * 0xF0 - Save Settings at node flash
  */

  // max values
  const MAX_SSID_CHARS = 33;
  const MAX_PWD_CHARS = 64;
  const MAX_APRS_CMT_CHARS = 15;

   // clear textfield of callsign input
   const clearInput = () => {
    callInputRef.current!.value = "";
  };


  // send new callsign to node
  // returns true if regex of callsign is correct
  const setCallSign = async () => {

    const nodeCall = callInputRef.current!.value;

    if (nodeCall) {

      if (nodeCall.toString() !== "") {

        let call_s = nodeCall.toString();
        call_s = call_s.toUpperCase();
        call_s = call_s.trim();
        call_s = normalizeCallsignSsid(call_s);
        console.log("Callsign setting: " + call_s);

        // check if callsign is valid
        if (!regexCallsign.test(call_s)) {
          console.log("Invalid Callsign!");
          clearInput();
          setAlHeader("Invalid Callsign!");
          setAlMsg("Please enter a valid Callsign like OE1KFR-1");
          setShAlertCard(true);
          return;
        }

        let cal_len = call_s.length;
        console.log("Callsign len: " + cal_len);
        
        if (cal_len > MAX_CALLSIGN_LEN) {
          console.log("Callsign too long!");
          clearInput();
          setAlHeader("Callsign too long!");
          setAlMsg("Please enter a valid Callsign with max " + MAX_CALLSIGN_LEN + " characters");
          setShAlertCard(true);
          return;
        }

        // set the callsign ref
        callSignInputRef.current = call_s;

        // send to node
        sendTxtCmd("setcall");

        // update config in store state
        ConfigStore.update(s => {
          s.config.callSign = call_s;
        });

        setAlHeader("Callsign set!");
        setAlMsg("Setting saved to node! Will reboot in 15s.");
        setShAlertCard(true);
      }
    }
    clearInput();

  }



  /**
   * send / configure position on node
   * 
   */
  const setCurrentPosGPS = async () => {
    console.log("Setting Current Position GPS");

    await setCurrPosGPS();
  };




  /**
   * send Wifi Settings to Node
   * */

  const setWifiSetting = async () =>{

    console.log("Setting Wifi Settings");

    const ssidWifi = ssidInputRef.current!.value;
    const pwdWifi = wifipwdInputRef.current!.value;
    
    if(ssidWifi && pwdWifi){

      ssidWifi_str.current = ssidWifi!.toString();
      pwdWifi_str.current = pwdWifi!.toString();

      // special case reset wifissid to none without pw
      if(ssidWifi_str.current !== "" && pwdWifi_str.current !== "" && ssidWifi_str.current.length <= MAX_SSID_CHARS && pwdWifi_str.current.length <= MAX_PWD_CHARS) {

        console.log("Wifi SSID: " + ssidWifi_str.current);
        console.log("Wifi PWD: " + pwdWifi_str.current);
        sendTxtCmd("setwifi");
        setAlHeader("Wifi Settings set!");
        setAlMsg("Setting saved to node! Will reboot in 15s.");
        setShAlertCard(true);

      }

      // reset inputs
      wifipwdInputRef.current!.value = "";
    }

  }


  // set APRS Symbol Config
  const setAprsSymbols = () => {

    if (aprs_pri_sec_valid.current && aprssym_valid.current) {

      if (aprsSym_changed.current) {

        aprsSym_changed.current = false;
        console.log("Aprs PriSec to Node: " + aprs_pri_sec_char.current);
        console.log("Aprs Symbol to Node: " + aprs_sym_char.current);

        const symbol_dec = +aprs_sym_char.current.charCodeAt(0);
        console.log("Aprs Symbol DEC: " + symbol_dec);

        const symbol_pri_sec = +aprs_pri_sec_char.current.charCodeAt(0);
        console.log("Aprs Pri/Sec DEC: " + symbol_pri_sec);

        // send the aprssym to node
        sendTxtCmd("setAprsChars");

        setAlHeader("APRS Symbol set!");
        setAlMsg("Setting saved to node!");
        setShAlertCard(true);

      }

    } else {
      console.log("Aprs Sym or Pri/Sec not valid!");
      setAlHeader("Invalid APRS Symbol!");
      setAlMsg("Group Char must be 0-9, A-Z, / and \\. Symbol Char must be ! to }");
      setShAlertCard(true);
      return;
    }

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

        if (sensorSettings_s.BMP) {
          cmd_ = "--bmx off";
        } else {
          if (sensorSettings_s.BME || sensorSettings_s['680'] || sensorSettings_s.BMP3) {
            setAlHeader("Switch BME280/BMP390/BME680 off please!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--bmp on";
          }
        }
        break;
      }

      case "680": {

        if (sensorSettings_s['680']) {
          cmd_ = "--680 off";
        } else {
          if (sensorSettings_s.BME || sensorSettings_s.BMP || sensorSettings_s.BMP3) {
            setAlHeader("Please switch BME/BMP off!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--680 on";
          }
        }
        break;
      }

      case "bmp3": {

        if (sensorSettings_s.BMP3) {
          cmd_ = "--bmx off";
        } else {
          if (sensorSettings_s.BME || sensorSettings_s.BMP || sensorSettings_s['680']) {
            setAlHeader("Please switch BME280/BMP/BME680 off!");
            setAlMsg("");
            setShAlertCard(true);
          } else {
            cmd_ = "--390 on";
          }
        }
        break;
      }

      case "mcu811": {

        if (sensorSettings_s['811']) {
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

      case "deepsleep": {

        cmd_ = "--deepsleep";
        // the link drops because the node sleeps: no auto reconnect after it
        AutoReconnectManager.getInstance().expectDisconnect();
        markConnected(false);   // the app can end before the disconnect arrives: no cold start reconnect either
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

            setAlHeader("APRS Comment set!");
            setAlMsg("Setting saved to node!");
            setShAlertCard(true);
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

      // time zone rule for the automatic summer / winter time change
      case "settz": {
        cmd_ = "--settz " + tz_cmd_str.current;
        break;
      }

      // fixed UTC offset to 0. The node has no "none" for it. Like any --utcoff it also removes the time zone rule
      case "RST_UTCOFF": {
        cmd_ = "--utcoff 0";
        break;
      }

      // UTC Offset
      case "utcoffset": {
        console.log("UTC Offset: " + node_utc_offset.current);
        cmd_ = "--utcoff " + node_utc_offset.current.toString();
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
          // check if wifi ssid is longer than 0 and not none
          if(nodeInfo_s.HWID !== 9){ // ESP32 only check
            if (config_s.wifi_ssid.length > 0 && config_s.wifi_ssid !== "none") {
              cmd_ = "--webserver on";
            } else {
              setAlHeader("Wifi Settings not set!");
              setAlMsg("Please set a valid Wifi SSID and PW!");
              setShAlertCard(true);
            }
          } else {
            cmd_ = "--webserver on";
          }
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
        if(nodeInfo_s.HWID !== 9 && nodeInfo_s.HWID !== 7 && nodeInfo_s.HWID !== 54){ // ESP32 only check
          cmd_ = "--ota-update";
          // the OTA firmware has no BLE and the flashing takes long: no auto reconnect after the link drops
          AutoReconnectManager.getInstance().expectDisconnect();
          markConnected(false);   // the app can end before the disconnect arrives: no cold start reconnect either
          setAlHeader("Booting into OTA Mode!");
          setAlMsg("On active Wifi connection access it after reboot via Web-Browser with " + nodeInfo_s.CALL + ".local or "+ wifiSettings_s.IP +" if in AP Mode: IP:192.168.4.1 or Meshcom-OTA.local");
          setShAlertCard(true);
        } else {
          setAlHeader("Wifi OTA Update not supported!");
          setAlMsg("Only on ESP32 based boards available!");
          setShAlertCard(true);
        }
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

      // reset BLE PIN to 000000 (disables BLE security)
      case "RST_BT_CODE": {
        console.log("Resetting BLE PIN to 000000 (security disabled)");
        ble_pairing_pin.current = "000000";
        cmd_ = "--btcode 000000";
        break;
      }

      // rx boost is only available on boards with a SX126x chip
      case "rxboost": {
        if (nodeInfo_s.HWID === 5 || nodeInfo_s.HWID >= 7 && nodeInfo_s.HWID <= 9 || nodeInfo_s.HWID >= 39) {
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

      // aht20 sensor on / off
      case "aht20": {
        if (sensorSettings_s.AHT) {
          cmd_ = "--aht20 off";
        } else {
          cmd_ = "--aht20 on";
        }
        break;
      }

      // set callsign
      case "setcall": {
        let call_s = callSignInputRef.current;
        if (call_s && call_s !== "") {
          console.log("Setting Callsign to node: " + call_s);
          cmd_ = "--setcall " + call_s;
          call_s = ""; // clear callsign input
        }
        break;
      }

      // set fixed IP setting all at once
      case "setFixedIP": {
        cmd_ = "--setownip " + ip_addr_str.current + " --setownms " + ip_snm_str.current + " --setowngw " + ip_gw_str.current + " --setowndns " + ip_dns_str.current;
        // NTP server is optional
        if (ip_ntp_str.current !== "") {
          cmd_ += " --setownntp " + ip_ntp_str.current;
        }
        console.log("IP CMD to node: " + cmd_);
        break;
      }

      // set the wifi settings
      case "setwifi": {
        cmd_ = "--setssid " + ssidWifi_str.current + " --setpwd " + pwdWifi_str.current;
        console.log("Wifi CMD to node: " + cmd_);
        break;
      }

      // set aprs id (table) and symbol
      case "setAprsChars": {
        console.log("Setting APRS Symbol and Pri/Sec Char to node");
        cmd_ = "--symid " + aprs_pri_sec_char.current + " --symcd " + aprs_sym_char.current;
        console.log("APRS CMD to node: " + cmd_);
        break;
      }

      // set the name 
      case "name": {
        cmd_ = "--setname " + name_str.current;
        console.log("Name CMD to node: " + cmd_);
        break;
      }

      // temp offests
      case "setTempOffset": {
        cmd_ = temp_offset_str.current;
        console.log("Temp Offset CMD to node: " + cmd_);
        break;
      }

      // ext udp setting toggle
      case "extUdpToggle": {
        cmd_ = ext_udp_enable_str.current;
        console.log("Ext UDP CMD to node: " + cmd_);
        break;
      }

      // ext udp ip setting
      case "extUdpIP": {
        cmd_ = ext_udp_IP_str.current;
        console.log("Ext UDP IP CMD to node: " + cmd_);
        break;
      }

      // via (manual routing) destination callsign
      case "viaCall": {
        cmd_ = via_call_str.current;
        console.log("Via Call CMD to node: " + cmd_);
        break;
      }

      // via (manual routing) toggle
      case "viaToggle": {
        cmd_ = via_enable_str.current;
        console.log("Via Toggle CMD to node: " + cmd_);
        break;
      }

      // reset via: disable and set destination callsign to none
      case "RST_VIA": {
        console.log("Resetting Via Callsign to none and disabling via");
        cmd_ = "--via off --via none";
        setAlHeader("Manual Routing reset!");
        setAlMsg("Destination Callsign set to NONE and disabled.");
        setShAlertCard(true);
        break;
      }

      case "maxhop": {
        cmd_ = "--maxhop " + maxHopSel;
        break;
      }

      case "maxv": {
        cmd_ = "--maxv " + maxv_cmd_val.current.toFixed(3);
        break;
      }

      // battery display: voltage or percent
      case "battDisp": {
        cmd_ = battDispSel === "volt" ? "--volt on" : "--proz on";
        break;
      }

      case "mtu": {
        cmd_ = "--mtu " + mtuSel;
        break;
      }

      // INA226 command built by the caller (--ina226 on/off, --shunt, --imax, --isamp)
      case "inaCmd": {
        cmd_ = ina_cmd_str.current;
        break;
      }

      // password of the net console and the KISS auth, only ever set or cleared, the node never sends it back
      case "netPwd": {
        cmd_ = "--passwd " + net_pwd_cmd_val.current;
        break;
      }

      // net console / KISS toggles, command built by the caller
      case "netCmd": {
        cmd_ = net_cmd_str.current;
        break;
      }

      // command typed by hand, already checked by checkManualCommand
      case "manualCmd": {
        cmd_ = manual_cmd_str.current;
        break;
      }

      // web ui password
      case "webPwd": {
        cmd_ = webpwd_str.current;
        console.log("Web Password CMD to node");
        break;
      }

      // reset web ui password to none
      case "RST_WEBPWD": {
        console.log("Resetting Web Password to none");
        cmd_ = "--webpwd none";
        setAlHeader("Web Password reset!");
        setAlMsg("Web UI is now without password.");
        setShAlertCard(true);
        break;
      }

      // rest wifi ssid and pwd
      case "RST_WIFI_SSID_PW": {
        console.log("Resetting Wifi SSID and PW to none");
        cmd_ = "--setssid none --setpwd none";
        setAlHeader("Wifi Settings reset!");
        setAlMsg("Wifi Settings reset to none! Will reboot in 15s.");
        setShAlertCard(true);
        break;
      }

      // reset aprs name
      case "RST_APRS_NAME": {
        console.log("Resetting APRS Name to none");
        cmd_ = "--setname none";
        break;
      }

      // reset aprs comment
      case "RST_APRS_COMMENT": {
        console.log("Resetting APRS Comment to none");
        cmd_ = "--atxt none";
        break;
      }

      // reset fixed ip settings
      case "RST_FIXED_IP": {
        console.log("Resetting Fixed IP Settings to none");
        cmd_ = "--setownip none --setownms none --setowngw none --setowndns none --setownntp none";
        setAlHeader("Fixed IP Settings reset!");
        setAlMsg("Fixed IP Settings reset to none! Will reboot in 15s.");
        setShAlertCard(true);
        break;  
      }

      // sht-21 sensor on off
      case "sht21": {
        if(sensorSettingsS1_s.SHT){
          cmd_ = "--sht21 off";
        } else {
          cmd_ = "--sht21 on";
        }
        break;
      }

      // manual position setting
      case "setManualPos": {
        console.log("Setting Manual Position to node: " + manual_pos_cmd.current);
        cmd_ = manual_pos_cmd.current;
        break;
      }

      // Gw Server setting
      case "setGWsrv": {
        cmd_ = "--gateway srv " + gw_srv_str.current;
        console.log("Gateway Server CMD to node: " + cmd_);
        break;
      }
    }

    // finally send it via textmsg
    sendTxtCmdNode(cmd_);
    LogS.log(0,"Settings Command: " + cmd_);

    // forward to info page when pos or wx info button pressed
    if (cmd === "posdebug" || cmd === "wx") {
      navigate('/info');
    }
  }



  /////// APRS Symbol Settings ///////
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


  

  ////// Setter for Settings Buttons //////
  // set the APRS comment
  const setAPRScomment = () => {
    
    if(aprsCmtRef.current!.value !== null && aprsCmtRef.current!.value !== undefined && aprsCmtRef.current!.value !== "" && aprsCmtRef.current!.value !== " "){
      const cmt_txt = aprsCmtRef.current!.value;
      LogS.log(0, "Setting APRS Comment: " + cmt_txt);
      sendTxtCmd("atxt");
      // clear input field
      aprsCmtRef.current!.value = "";
    }
  }
  
    
  // Rule and fixed offset exclude each other on the node (a rule owns the offset, --utcoff removes the rule),
  // so filling one field empties the other.
  // preset picked: put its rule into the text field (still editable), it is only sent with the set button
  const tzPresetChanged = (id: string | undefined) => {
    const preset = TZ_PRESETS.find(p => p.id === id);
    if (preset) tzTextChanged(preset.tz);
  }

  const tzTextChanged = (val: string) => {
    setTzText(val);
    if (val.trim() !== "") setUtcText("");
  }

  const utcTextChanged = (val: string) => {
    setUtcText(val);
    if (val.trim() !== "") setTzText("");
  }

  // set the time zone rule. The node drops a fixed UTC offset when it takes a rule
  const setTimeZone = () => {
    const tz = tzText.trim();
    const err = checkTzRule(tz);
    if (err !== "") {
      setAlHeader("Time zone not set!");
      setAlMsg(err);
      setShAlertCard(true);
      return;
    }
    tz_cmd_str.current = tz;
    sendTxtCmd("settz");
    setAlHeader("Time zone sent!");
    setAlMsg("The node changes summer and winter time automatically. A rule the node does not accept is ignored.");
    setShAlertCard(true);
  }

  // the one set button: the rule if there is one, else the fixed offset
  const setTime = () => {
    if (tzText.trim() !== "") {
      setTimeZone();
    } else {
      setUTCOffset();
    }
  }

  // the one RST button: no rule, fixed offset 0. The node has no "unset" for the offset, --utcoff 0 is its reset
  const resetTime = () => {
    sendTxtCmd("RST_UTCOFF");
    setAlHeader("Time reset!");
    setAlMsg(tzSupported ? "Time zone rule removed, fixed offset is 0. Automatic time change is disabled." : "Fixed offset is 0 now.");
    setShAlertCard(true);
  }

  // set the UTC Time Offset
  const setUTCOffset = () => {

    if (utcText.trim() !== "" && !isNaN(+utcText)) {

      const offset_nr = +utcText;

      // check if the offset is +/-14 max or > 28 and fire alert card if needed
      if (offset_nr >= -15 && offset_nr <= 28) {
          node_utc_offset.current = offset_nr;
          console.log("Setting UTC Offset: " + node_utc_offset.current);
          sendTxtCmd("utcoffset");
          setAlHeader("UTC Offset set!");
          setAlMsg(tzSupported ? "Setting saved to node! Automatic time change is disabled." : "Setting saved to node!");
          setShAlertCard(true);
      } else {
        console.log("UTC Offset not set!");
        setAlHeader("UTC Offset not set!");
        setAlMsg("Please enter a valid UTC Offset!");
        setShAlertCard(true);
      }
    } else {
      setAlHeader("UTC Offset not set!");
      setAlMsg("Please enter a valid UTC Offset!");
      setShAlertCard(true);
    }
  }


  // set the onewire pin number
  const setOnewirePin = () => {

    if (owPinInputRef.current!.value !== undefined && owPinInputRef.current!.value !== null) {
      const pin_str = owPinInputRef.current!.value.toString();
      const pin_nr = +pin_str;

      console.log("Setting Onewire Pin: " + pin_nr);

      if (pin_nr >= 0 && pin_nr <= MAX_PIN_NUM) {
          owPinNr.current = pin_nr;
          sendTxtCmd("owpin");
          setAlHeader("Onewire Pin set!");
          setAlMsg("Setting saved to node!");
          setShAlertCard(true);
      } else {
        console.log("Onewire Pin not set!");
        setAlHeader("Onewire Pin not set!");
        setAlMsg("Please enter a valid Onewire Pin Number!");
        setShAlertCard(true);
      }
    }
  }



  // set the user button pin number
  const setUserButtonPin = async () => {

    if (userBtnInputRef.current!.value !== undefined && userBtnInputRef.current!.value !== null) {
      const pin_str = userBtnInputRef.current!.value.toString();
      const pin_nr = +pin_str;

      console.log("Setting Userbutton Pin: " + pin_nr);

      if (pin_nr >= 0 && pin_nr <= MAX_USER_BTN_NUM) {
          userBtnNr.current = pin_nr;
          sendTxtCmd("userButtonPin");
          setAlHeader("User Button Pin set!");
          setAlMsg("Setting saved to node!");
          setShAlertCard(true);
      } else {
        setAlHeader("Wrong Userbutton Pin Number!");
        setAlMsg("Pin Nr not in Range!");
        setShAlertCard(true);
      }
    } 
  } 



  // set the country setting
  const setCountrySetting = async () => {
    if (ctry_setting_changed_str.current !== "" && ctry_setting_changed_str.current !== " ") {
      console.log("Setting Country: " + ctry_setting_changed_str.current);
      sendTxtCmd("ctry");
    } else {
      console.log("Country setting not set!");
      setAlHeader("Country setting not set!");
      setAlMsg("Please enter a valid Country Code!");
      setShAlertCard(true);
    }
  }


  // set the fixed IP adresses 
  const setFixedIP = () => {
    console.log("Setting Fixed IP Adresses");
    // check if the IP adresses are valid
    if(ip_addr_ref.current !== null && ip_addr_ref.current !== undefined &&
       ip_snm_ref.current !== null && ip_snm_ref.current !== undefined &&
       ip_gw_ref.current !== null && ip_gw_ref.current !== undefined &&
       ip_dns_ref.current !== null && ip_dns_ref.current !== undefined) {

      ip_addr_str.current = ip_addr_ref.current!.value!.toString();
      ip_snm_str.current = ip_snm_ref.current!.value!.toString();
      ip_gw_str.current = ip_gw_ref.current!.value!.toString();
      ip_dns_str.current = ip_dns_ref.current!.value!.toString();
      ip_ntp_str.current = (ip_ntp_ref.current?.value ?? "").toString().trim();
      console.log("IP Address: " + ip_addr_str.current);
      console.log("IP Subnet Mask: " + ip_snm_str.current);
      console.log("IP Gateway: " + ip_gw_str.current);
      console.log("IP DNS: " + ip_dns_str.current);
      console.log("IP NTP: " + ip_ntp_str.current);

      // check if the IP adresses are valid
      if(ip_addr_str && ip_snm_str && ip_gw_str && ip_dns_str) {
        // NTP is optional: only checked when set
        const ntp_ok = ip_ntp_str.current === "" || ip_regex.test(ip_ntp_str.current);
        if(ip_regex.test(ip_addr_str.current) && ip_regex.test(ip_snm_str.current) && ip_regex.test(ip_gw_str.current) && ip_regex.test(ip_dns_str.current) && ntp_ok) {
          // all IP adresses are valid
          console.log("IP Adresses are valid");
          // send the IP adresses to the node
          sendTxtCmd("setFixedIP");
        } else {
          console.log("IP Adresses not valid!");
          setAlHeader("IP Adresses not valid!");
          setAlMsg("Please enter a valid IP Address, Subnet Mask, Gateway, DNS and optional NTP!");
          setShAlertCard(true);
        }
      }
    }
  }


  // set the name setting from namesetting ref
  const setNameSetting = () => {
    if (name_input_ref.current !== null && name_input_ref.current !== undefined) {
      name_str.current = name_input_ref.current.value!.toString();
      if(name_str.current !== "" && name_str.current !== " " && name_str.current.length <= MAX_NAME_CHARS) {
        name_str.current = name_str.current.trim();
        console.log("Setting Name: " + name_str.current);
        sendTxtCmd("name");
        setAlHeader("Name set!");
        setAlMsg("Setting saved to node!");
        setShAlertCard(true);
      } else {
        console.log("Name setting not set!");
        setAlHeader("Name setting not set!");
        setAlMsg("Please enter a valid Name!");
        setShAlertCard(true);
      }
    }
  }


    // set the temperature offset 
  const setTempOffset = () => {
    if (temp_offset_ref.current !== null && temp_offset_ref.current !== undefined && temp_ow_offset_ref.current !== null && temp_ow_offset_ref.current !== undefined) {
      const temp_offset_ = temp_offset_ref.current.value!.toString();
      const temp_offset_ow_ = temp_ow_offset_ref.current.value!.toString();
      // check if the offset is a number
      const temp_offset_nr = +temp_offset_;
      const temp_offset_ow_nr = +temp_offset_ow_;
      if (!isNaN(temp_offset_nr) && !isNaN(temp_offset_ow_nr)) {
        console.log("Setting Temperature Offset: " + temp_offset_nr + " and Onewire Offset: " + temp_offset_ow_nr);
        // check if the offset is in range -50 to 50
        if (temp_offset_nr >= -50 && temp_offset_nr <= 50 && temp_offset_ow_nr >= -50 && temp_offset_ow_nr <= 50) {
          // set the offsets
          temp_offset_str.current = "--tempoff in " + temp_offset_ + " --tempoff out " + temp_offset_ow_;
          sendTxtCmd("setTempOffset");
          setAlHeader("Temperature Offset set!");
          setAlMsg("Setting saved to node!");
          setShAlertCard(true);
        } else {
          console.log("Temperature Offset not set!");
          setAlHeader("Temperature Offset not set!");
          setAlMsg("Please enter a valid Temperature Offset between -50 and 50!");
          setShAlertCard(true);
        }
      } else {
        console.log("Temperature Offset not set!");
        setAlHeader("Temperature Offset not set!");
        setAlMsg("Please enter a valid Temperature Offset!");
        setShAlertCard(true);
      }
    }
  }


  // set the external UDP Settings
  const setExtUdpIP = () => {
    if (ext_udp_ip_ref.current !== null && ext_udp_ip_ref.current !== undefined) {
      const ext_udp_ip = ext_udp_ip_ref.current.value!.toString();
      console.log("Ext UDP IP: " + ext_udp_ip);
      // check if the IP is valid with regex
      if (ip_regex.test(ext_udp_ip) && ext_udp_ip !== "" && ext_udp_ip !== " " && ext_udp_ip !== "0.0.0.0") {
        // set the ext UDP IP in the store
        console.log("Ext UDP IP is valid");
        ext_udp_IP_str.current = "--extudpip " + ext_udp_ip;
        sendTxtCmd("extUdpIP");
        setAlHeader("Ext UDP IP set!");
        setAlMsg("Ext UDP IP Address set: " + ext_udp_ip);
        setShAlertCard(true);
      } else {
        console.log("Ext UDP IP is not valid");
        setAlHeader("Ext UDP IP not valid!");
        setAlMsg("Please enter a valid IP Address for the Ext UDP IF!");
        setShAlertCard(true);
        return;
      }
    }
  }

  // enabling the ext UDP IF with toggle. Getting Ion-Event
  const enableExtUDP = (ev:any) => {
    console.log("Enable Ext UDP: " + ev.detail.checked);
    if (ev.detail.checked) {
      // check if the ext UDP IP is set correctly with regex
      if (ext_udp_ip_ref.current !== null && ext_udp_ip_ref.current !== undefined) {
        const ext_udp_ip = ext_udp_ip_ref.current.value!.toString();
        console.log("Ext UDP IP: " + ext_udp_ip);
        // check if the IP is valid with regex
        if (ip_regex.test(ext_udp_ip) && ext_udp_ip !== "" && ext_udp_ip !== " " && ext_udp_ip !== "0.0.0.0") {
          // set the ext UDP IP in the store
          console.log("Ext UDP IP is valid");
          ext_udp_enable_str.current = "--extudp on";
          sendTxtCmd("extUdpToggle");
          setAlHeader("Ext UDP IF enabled!");
          setAlMsg("Ext UDP Interface enabled!");
          setShAlertCard(true);
        } else {
          console.log("Ext UDP IP is not valid");
          setAlHeader("Ext UDP IP not valid!");
          setAlMsg("Please enter a valid IP Address for the Ext UDP IF!");
          setShAlertCard(true);
          // set the toggle back to false
          WifiSettingsStore2.update(s => {
            s.wifiSettings2.EUDP = false;
          });
          return;
        }
      }
    } else {
      // disable the ext UDP IF
      console.log("Disabling Ext UDP IF");
      ext_udp_enable_str.current = "--extudp off";
      sendTxtCmd("extUdpToggle");
      setAlHeader("Ext UDP IF disabled!");
      setAlMsg("Ext UDP Interface disabled!");
      setShAlertCard(true);
    }
  }

  // Manual Routing Settings ///////
  // read the via destination callsign from the input field (uppercased, trimmed)
  const readViaCallInput = (): string => {
    return (via_call_ref.current?.value ?? "").toString().toUpperCase().trim();
  }

  // check the via destination callsign, shows an alert if it is not valid
  const isValidViaCall = (via_call: string): boolean => {
    if (!regexCallsign.test(via_call) || via_call.length > MAX_CALLSIGN_LEN) {
      console.log("Via Callsign is not valid");
      setAlHeader("Invalid Callsign!");
      setAlMsg("The Destination Callsign does not match the callsign rules (eg. OE1KFR-12, max " + MAX_CALLSIGN_LEN + " characters)!");
      setShAlertCard(true);
      return false;
    }
    return true;
  }

  // set the via destination callsign
  const setViaCall = () => {
    if (via_call_ref.current !== null && via_call_ref.current !== undefined) {
      const via_call = readViaCallInput();
      console.log("Via Callsign: " + via_call);

      if (!isValidViaCall(via_call)) return;

      via_call_str.current = "--via " + via_call;
      sendTxtCmd("viaCall");
      setAlHeader("Manual Routing set!");
      setAlMsg("Destination Callsign set: " + via_call);
      setShAlertCard(true);
    }
  }

  // enabling via with toggle. Getting Ion-Event
  const enableVia = (ev:any) => {
    console.log("Enable Via: " + ev.detail.checked);
    if (ev.detail.checked) {
      // a callsign was typed but not confirmed with the checkmark button:
      // set it and enable via in one command
      const typed_call = readViaCallInput();
      if (typed_call !== "" && typed_call !== nodeSettingsS1_s.VIACALL) {
        console.log("Via Callsign typed but not set: " + typed_call);
        if (!isValidViaCall(typed_call)) {
          // set the toggle back to false
          NodeSettingsStoreS1.update(s => {
            s.nodeSettingsS1.VIA = false;
          });
          return;
        }
        via_enable_str.current = "--via " + typed_call + " --via on";
        sendTxtCmd("viaToggle");
        setAlHeader("Manual Routing set!");
        setAlMsg("Destination Callsign set: " + typed_call + " and enabled.");
        setShAlertCard(true);
        return;
      }

      // via needs a destination callsign set on the node
      if (nodeSettingsS1_s.VIACALL === "") {
        console.log("No Via Callsign set on node");
        setAlHeader("No Destination Callsign!");
        setAlMsg("Please set a Destination Callsign first!");
        setShAlertCard(true);
        // set the toggle back to false
        NodeSettingsStoreS1.update(s => {
          s.nodeSettingsS1.VIA = false;
        });
        return;
      }
      via_enable_str.current = "--via on";
    } else {
      via_enable_str.current = "--via off";
    }
    sendTxtCmd("viaToggle");
  }

  // Web UI Password Settings ///////
  // set the max voltage of the battery
  const setMaxVoltage = () => {
    const check = checkMaxVoltage(maxVText);
    if (!check.ok) {
      setAlHeader("Max. voltage not set!");
      setAlMsg(check.error);
      setShAlertCard(true);
      return;
    }
    maxv_cmd_val.current = check.value;
    sendTxtCmd("maxv");
    setAlHeader("Max. voltage set!");
    setAlMsg("Setting saved to node!");
    setShAlertCard(true);
  }

  // switch a net console / KISS setting. The node answers with its settings, the button follows them
  const sendNetToggle = (name: string, currentlyOn: boolean) => {
    net_cmd_str.current = "--" + name + (currentlyOn ? " off" : " on");
    sendTxtCmd("netCmd");
  }

  // INA226: send one command, the node answers with its sensor settings (S1)
  const sendInaCmd = (cmd: string) => {
    ina_cmd_str.current = cmd;
    sendTxtCmd("inaCmd");
  }

  // INA226: send the values that differ from the node, one command after the other so the node can handle each
  const setIna226 = () => {
    const check = checkIna226(inaShuntText, inaImaxText);
    if (!check.ok) {
      setAlHeader("INA226 not set!");
      setAlMsg(check.error);
      setShAlertCard(true);
      return;
    }
    const cmds: string[] = [];
    if (check.shunt !== +inaNumText(sensorSettingsS1_s.SHUNT)) cmds.push("--shunt " + check.shunt);
    if (check.imax !== +inaNumText(sensorSettingsS1_s.IMAX)) cmds.push("--imax " + check.imax);
    if (inaSampSel !== sensorSettingsS1_s.SAMP) cmds.push("--isamp " + inaSampSel);
    if (cmds.length === 0) {
      setAlHeader("INA226");
      setAlMsg("No change to the values on the node.");
      setShAlertCard(true);
      return;
    }
    cmds.forEach((c, i) => window.setTimeout(() => sendInaCmd(c), i * 400));
    setAlHeader("INA226 set!");
    setAlMsg("Setting saved to node!");
    setShAlertCard(true);
  }

  const setNetPassword = () => {
    const check = checkNetPassword(netPwdText);
    if (!check.ok) {
      setAlHeader("Password not set!");
      setAlMsg(check.error);
      setShAlertCard(true);
      return;
    }
    net_pwd_cmd_val.current = check.pwd;
    sendTxtCmd("netPwd");
    setNetPwdText("");
    setAlHeader("Password set!");
    setAlMsg("Setting saved to node! It is used by the remote netconsole and the KISS auth.");
    setShAlertCard(true);
  }

  const resetNetPassword = () => {
    net_pwd_cmd_val.current = "none";
    sendTxtCmd("netPwd");
    setNetPwdText("");
    setAlHeader("Password reset!");
    setAlMsg("The password is cleared, remote netconsole and KISS auth are open to everyone then.");
    setShAlertCard(true);
  }

  // the KISS auth uses the password of the remote netconsole, tell the user and switch as usual
  const kissAuthPressed = (currentlyOn: boolean) => {
    setAlHeader("KISS Auth");
    setAlMsg("The KISS auth uses the password of the Remote Netconsole setting. Set it there.");
    setShAlertCard(true);
    sendNetToggle("kiss auth", currentlyOn);
  }

  // send the command of the Manual Command field, only if it starts with two hyphens
  const sendManualCommand = () => {
    const check = checkManualCommand(manualCmdText);
    if (!check.ok) {
      setAlHeader("Command not sent!");
      setAlMsg(check.error);
      setShAlertCard(true);
      return;
    }
    manual_cmd_str.current = check.cmd;
    sendTxtCmd("manualCmd");
    setManualCmdText("");
  }

  const setWebPwd = () => {
    const web_pwd = (webpwd_ref.current?.value ?? "").toString().trim();

    if (web_pwd === "") {
      setAlHeader("No Password!");
      setAlMsg("Please enter a password or use RST to remove it.");
      setShAlertCard(true);
      return;
    }

    // "none" resets the password in the firmware
    if (web_pwd.toLowerCase() === "none") {
      setAlHeader("Invalid Password!");
      setAlMsg("\"none\" is reserved. Use RST to remove the password.");
      setShAlertCard(true);
      return;
    }

    if (web_pwd.length > MAX_WEBPWD_LEN) {
      setAlHeader("Invalid Password!");
      setAlMsg("The password can have max " + MAX_WEBPWD_LEN + " characters.");
      setShAlertCard(true);
      return;
    }

    webpwd_str.current = "--webpwd " + web_pwd;
    sendTxtCmd("webPwd");
    setAlHeader("Web Password set!");
    setAlMsg("The Web UI of the node now asks for this password.");
    setShAlertCard(true);
  }

  // Manual Position Settings ///////
  const setManualPos = () => {
    console.log("Setting Manual Position");
    if(manual_lat_ref.current !== null && manual_lat_ref.current !== undefined &&
        manual_lon_ref.current !== null && manual_lon_ref.current !== undefined &&
        manual_alt_ref.current !== null && manual_alt_ref.current !== undefined) {

      const lat_str = manual_lat_ref.current!.value!.toString();
      const lon_str = manual_lon_ref.current!.value!.toString();
      const alt_str = manual_alt_ref.current!.value!.toString();
      console.log("Manual Lat: " + lat_str);
      console.log("Manual Lon: " + lon_str);
      console.log("Manual Alt: " + alt_str);

      // check if the lat and lon are valid numbers
      const lat_nr = +lat_str;
      const lon_nr = +lon_str;
      const alt_nr = +alt_str;

      if(!isNaN(lat_nr) && !isNaN(lon_nr) && !isNaN(alt_nr)){
        // check if the lat and lon are in valid range
        if(lat_nr >= -90 && lat_nr <= 90 && lon_nr >= -180 && lon_nr <= 180 && alt_nr >= 0){
          // all values are valid
          console.log("Manual Position is valid");
          const cmd_str = "--setlat " + lat_str + " --setlon " + lon_str + " --setalt " + alt_str;
          console.log("Manual Position CMD: " + cmd_str);
          manual_pos_cmd.current = cmd_str;
          sendTxtCmd("setManualPos");
          setAlHeader("Manual Position set!");
          setAlMsg("Manual Position saved to node!");
          setShAlertCard(true);
        } else {
          console.log("Manual Position not valid!");
          setAlHeader("Manual Position not valid!");
          setAlMsg("Please enter a valid Latitude (-90 to 90), Longitude (-180 to 180) and Altitude (>=0)!");
          setShAlertCard(true);
        }
      } else {
        console.log("Manual Position not valid!");
        setAlHeader("Manual Position not valid!");
        setAlMsg("Please enter a valid Latitude, Longitude and Altitude!");
        setShAlertCard(true);
      }

    }
  }



  // send the GW server command to the node
  const setGWsrvToNode = () => {
    console.log("Setting Gateway Server to node: " + gw_srv_str.current);
    sendTxtCmd("setGWsrv");
    setAlHeader("Gateway Server set!");
    setAlMsg("Gateway Server saved to node!");
    setShAlertCard(true);
  }


  /////// Group Settings ///////
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
    if(grp0 !== null && grp0 !== undefined){
      const val0 = (grp0.trim() === "") ? "0" : grp0;
      console.log("Group 0 changed: " + val0);
      gcb0Ref.current = checkGrpInput(val0);
      console.log("Group 0 nr: " + gcb0Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp1Changed = (event: any) => {
    const grp1 = event.target.value;
    if(grp1 !== null && grp1 !== undefined){
      const val1 = (grp1.trim() === "") ? "0" : grp1;
      console.log("Group 1 changed: " + val1);
      gcb1Ref.current = checkGrpInput(val1);
      console.log("Group 1 nr: " + gcb1Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp2Changed = (event: any) => {
    const grp2 = event.target.value;
    if(grp2 !== null && grp2 !== undefined){
      const val2 = (grp2.trim() === "") ? "0" : grp2;
      console.log("Group 2 changed: " + val2);
      gcb2Ref.current = checkGrpInput(val2);
      console.log("Group 2 nr: " + gcb2Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp3Changed = (event: any) => {
    const grp3 = event.target.value;
    if(grp3 !== null && grp3 !== undefined){
      const val3 = (grp3.trim() === "") ? "0" : grp3;
      console.log("Group 3 changed: " + val3);
      gcb3Ref.current = checkGrpInput(val3);
      console.log("Group 3 nr: " + gcb3Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp4Changed = (event: any) => {
    const grp4 = event.target.value;
    if(grp4 !== null && grp4 !== undefined){
      const val4 = (grp4.trim() === "") ? "0" : grp4;
      console.log("Group 4 changed: " + val4);
      gcb4Ref.current = checkGrpInput(val4);
      console.log("Group 4 nr: " + gcb4Ref.current);
      groupSettingChanged.current = true;
    }
  }

  const grp5Changed = (event: any) => {
    const grp5 = event.target.value;
    if(grp5 !== null && grp5 !== undefined){
      const val5 = (grp5.trim() === "") ? "0" : grp5;
      console.log("Group 5 changed: " + val5);
      gcb5Ref.current = checkGrpInput(val5);
      console.log("Group 5 nr: " + gcb5Ref.current);
      groupSettingChanged.current = true;
    }
  }
  
  // set the group settings when the group settings are changed
  const setGroupSettings = () => {

    // check if any group setting changed
    if (groupSettingChanged.current) {

      console.log("Setting Group Settings");
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

      console.log("Time in ms: " + Date.now());
      sendTxtCmd("setGroup");

      setAlHeader("Group Settings set!");
      setAlMsg("Group Settings saved to node!");
      setShAlertCard(true);
      
    }
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
      const max_pwr_w = Math.pow(10, (maxTXpwr.current - 30) / 10) * 1000;
      setTxPwrPct(Math.round((+pwr_w) / max_pwr_w * 100));
      sendTxtCmd("txpwr");
    }
  }, [txpower_slider]);






  // handle custom pairing pin input
  const handleBLEParingPinInput = (event: string) => {
    console.log("Custom BLE Pairing Pin changed!");
    console.log("Event Pin: " + event);
    ble_pairing_pin.current = event ?? "";
    setBLEPairingPinDisplay(event ?? "");
  }

  // reset BLE PIN to 000000 — clears DB entry and sends command to node
  const resetBLEPin = async () => {
    if (devID_s) {
      await DataBaseService.checkDbConn();
      await DataBaseService.clearBlePin(devID_s);
      setBLEPairingPinDisplay("000000");
      console.log("BLE PIN cleared in DB for devID: " + devID_s);
    }
    sendTxtCmd("RST_BT_CODE");
  };

  // validate and send custom pairing pin to node
  const setBLEParingPin = async () => {
    const pinRaw = ble_pairing_pin_ref.current?.value?.toString() ?? ble_pairing_pin.current ?? "";
    const pin = pinRaw.trim();

    if (!/^\d{6}$/.test(pin)) {
      setAlHeader("Invalid BLE PIN!");
      setAlMsg("BLE PIN must be exactly 6 digits (0-9).");
      setShAlertCard(true);
      return;
    }

    if (parseInt(pin, 10) < 100000) {
      setAlHeader("Invalid BLE PIN!");
      setAlMsg("BLE PIN must be between 100000 and 999999");
      setShAlertCard(true);
      return;
    }

    ble_pairing_pin.current = pin;
    sendTxtCmd("btcode");

    if (devID_s) {
      await DataBaseService.checkDbConn();
      await DataBaseService.setBlePin(devID_s, pin);
      console.log("BLE PIN saved in DB for devID: " + devID_s);
    }

    setAlHeader("BLE PIN set!");
    setAlMsg("Setting saved to node.");
    setShAlertCard(true);
  }

  // handle clear all pairing pins in DB
  const clearAllBLEPins_ = async () => {
    await DataBaseService.checkDbConn();
    await DataBaseService.clearAllBlePins();
    console.log("All BLE PINs cleared in DB");
    setAlHeader("All BLE PINs cleared!");
    setAlMsg("All BLE PINs cleared from database.");
    setShAlertCard(true);
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


  // handle OTA Update Button
  const handleOTAUpdate = () => {
    setShOTAUpdateCard(true);
  }


  // ask the node for a fresh GPS json and return its fix state
  // firmware only sends the GPS json (SFIX = posinfo_fix) on --pos, so the store can be stale
  // falls back to the stored fix state if no answer arrives in time
  const requestGpsFix = (): Promise<boolean> => {
    return new Promise((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout>;
      const unsubscribe = GpsDataStore.subscribe(s => s.gpsData, (gps) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(gps.SFIX);
      });
      timer = setTimeout(() => {
        if (done) return;
        done = true;
        unsubscribe();
        LogS.log(1, "Send POS: no GPS data from node, using stored fix state");
        resolve(GpsDataStore.getRawState().gpsData.SFIX);
      }, GPS_FIX_WAIT_MS);
      sendTxtCmdNode("--pos");
    });
  }


  // Send POS button
  // TRACK off: --sendpos as before
  // TRACK on with GPS fix: --sendpos, firmware sends LoRa-APRS (and MeshCom if the channel was quiet)
  // TRACK on without GPS fix: firmware would only send MeshCom, so let the user choose
  const handleSendPos = async () => {
    if (sendPosBusy.current) return;

    if (Date.now() - txpos_last.current < minWaitTime_txpos) {
      setAlHeader("TXPOS already sent!");
      setAlMsg("TX POS only every " + minWaitTime_txpos / 1000 + " sec possible!");
      setShAlertCard(true);
      return;
    }

    if (!config_s.track_on) {
      sendTxtCmd("txpos");
      return;
    }

    sendPosBusy.current = true;
    const hasFix = await requestGpsFix();
    sendPosBusy.current = false;
    LogS.log(0, "Send POS in TRACK mode, GPS fix: " + hasFix);

    if (hasFix) {
      sendTxtCmd("txpos");
      setAlHeader("Send POS");
      setAlMsg("LoRa-APRS Position TX triggered!");
      setShAlertCard(true);
    } else {
      setShSendPosChoice(true);
    }
  }




  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="mc-toolbar">
          <IonTitle>Node Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding mc-page">
        <IonHeader collapse="condense">
          <IonToolbar className="mc-toolbar">
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
          isOpen={shDeepSleepCard}
          header="Deep Sleep"
          message="Send node into Deep Sleep now?"
          buttons={[
            {
              text: 'Cancel',
              handler: () => {
                console.log('Deep Sleep canceled');
                setShDeepSleepCard(false);
              },
            },
            {
              text: 'YES',
              handler: () => {
                console.log('Deep Sleep confirmed');
                setShDeepSleepCard(false);
                sendTxtCmd("deepsleep");
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

        <IonAlert
          isOpen={shSendPosChoice}
          header="No GPS fix"
          message="TRACK mode is on but the node has no GPS fix. Which position should be sent?"
          onDidDismiss={() => setShSendPosChoice(false)}
          buttons={[
            {
              text: 'Manual LoRa-APRS POS',
              handler: () => {
                console.log('Send POS: manual LoRa-APRS position');
                sendTxtCmd("txtrack");
              },
            },
            {
              text: 'Manual MeshCom POS',
              handler: () => {
                console.log('Send POS: manual MeshCom position');
                sendTxtCmd("txpos");
              },
            },
            {
              text: 'Cancel',
              role: 'cancel',
            },
          ]}
        />

        <div className="mc-stack">
          <div className="mc-card mc-hero st-hero">
            <div className="mc-hero-top">
              <div>
                <div className="mc-hero-main st-call">{config_s.callSign}</div>
                <div className="mc-hero-sub">Node Callsign</div>
              </div>
              <div className="mc-stats st-stats">
                <div className="mc-stat">
                  <div className="mc-stat-value">{config_s.frequency}<small> MHz</small></div>
                  <div className="mc-stat-label">QRG</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-value">{nodeSettings.TXP}<small> dBm</small></div>
                  <div className="mc-stat-label">TX Pwr</div>
                </div>
              </div>
            </div>
          </div>

          <div className='mc-card'>
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={mapOutline} /></div>
              <div className="mc-card-title">APRS</div>
            </div>
            <div className="mc-rows">
              <div className="mc-row"><div className="mc-label">Symbol ID</div><div className="mc-value">{aprs_settings_s.SYMID}</div></div>
              <div className="mc-row"><div className="mc-label">Symbol</div><div className="mc-value">{aprs_settings_s.SYMCD}</div></div>
              {aprs_settings_s.ATXT.trim().length > 0 && <div className="mc-row"><div className="mc-label">Comment</div><div className="mc-value">{aprs_settings_s.ATXT}</div></div>}
              {aprs_settings_s.NAME.length > 0 && <div className="mc-row"><div className="mc-label">Name</div><div className="mc-value">{aprs_settings_s.NAME}</div></div>}
            </div>
          </div>

          {(grp0 > 0 || grp1 > 0 || grp2 > 0 || grp3 > 0 || grp4 > 0 || grp5 > 0) && <div className='mc-card'>
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={peopleOutline} /></div>
              <div className="mc-card-title">Call Groups</div>
            </div>
            <div className="mc-rows">
              {grp0 > 0 && <div className="mc-row"><div className="mc-label">Group 1</div><div className="mc-value">{grp0}</div></div>}
              {grp1 > 0 && <div className="mc-row"><div className="mc-label">Group 2</div><div className="mc-value">{grp1}</div></div>}
              {grp2 > 0 && <div className="mc-row"><div className="mc-label">Group 3</div><div className="mc-value">{grp2}</div></div>}
              {grp3 > 0 && <div className="mc-row"><div className="mc-label">Group 4</div><div className="mc-value">{grp3}</div></div>}
              {grp4 > 0 && <div className="mc-row"><div className="mc-label">Group 5</div><div className="mc-value">{grp4}</div></div>}
              {grp5 > 0 && <div className="mc-row"><div className="mc-label">Group 6</div><div className="mc-value">{grp5}</div></div>}
            </div>
          </div>
          }

          <div className='mc-card'>
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={config_s.hw != "RAK4631" ? wifiOutline : gitNetworkOutline} /></div>
              <div className="mc-card-title">{config_s.hw != "RAK4631" ? "WiFi" : "Ethernet"}</div>
            </div>
            <div className="mc-rows">
              {config_s.hw != "RAK4631" ? <>
              <div className="mc-row"><div className="mc-label">SSID</div><div className="mc-value">{wifiSettings_s.SSID}</div></div>
              <div className="mc-row"><div className="mc-label">IP</div><div className="mc-value">{wifiSettings_s.IP}</div></div>
              <div className="mc-row"><div className="mc-label">Gateway</div><div className="mc-value">{wifiSettings_s.GW}</div></div>
              <div className="mc-row"><div className="mc-label">Subnet Mask</div><div className="mc-value">{wifiSettings_s.SUB}</div></div>
              <div className="mc-row"><div className="mc-label">DNS</div><div className="mc-value">{wifiSettings_s.DNS}</div></div>
              {ownNtpSet && <div className="mc-row"><div className="mc-label">NTP</div><div className="mc-value">{wifiSettings2_s.OWNNTP}</div></div>}
              </>:<>
              <div className="mc-row"><div className="mc-label">IP</div><div className="mc-value">{wifiSettings_s.IP}</div></div>
              <div className="mc-row"><div className="mc-label">Gateway</div><div className="mc-value">{wifiSettings_s.GW}</div></div>
              <div className="mc-row"><div className="mc-label">Subnet Mask</div><div className="mc-value">{wifiSettings_s.SUB}</div></div>
              <div className="mc-row"><div className="mc-label">DNS</div><div className="mc-value">{wifiSettings_s.DNS}</div></div>
              </>}
            </div>
          </div>

          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={idCardOutline} /></span><span className="mc-card-title">Callsign</span></div>
              <div>
                <IonButton size="small" fill="outline" color='success' onClick={() => setCallSign()}>
                  <IonIcon icon={checkmarkCircle} ></IonIcon>
                </IonButton>
              </div>
            </div>
            <IonItem>
              <IonInput ref={callInputRef} label='Set Node Callsign' labelPlacement="floating" placeholder="eg. OE1KFR-1" type='text' maxlength={MAX_CALLSIGN_LEN}></IonInput>
            </IonItem>
          </div>


          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={wifiOutline} /></span><span className="mc-card-title">WiFi Settings</span></div>
              <div className='rst-set-btns'>
                <div>
                  <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_WIFI_SSID_PW")}>RST</IonButton>
                </div>
                <div>
                  <IonButton size="small" fill="outline" color='success' onClick={() => setWifiSetting()}>
                    <IonIcon icon={checkmarkCircle} ></IonIcon>
                  </IonButton>
                </div>
              </div>
            </div>
            <IonItem>
              <IonInput ref={ssidInputRef} value={wifiSettings_s.SSID} label='Set WiFi SSID' labelPlacement="floating" placeholder='SSID' type='text' maxlength={MAX_SSID_CHARS}></IonInput>
            </IonItem>
            <IonItem>
              <IonInput ref={wifipwdInputRef} label='Set WiFi Password' labelPlacement="floating" placeholder='PWD' type={shWifiPwd ? 'text' : 'password'} maxlength={MAX_PWD_CHARS}></IonInput>
              <IonIcon slot='end' icon={shWifiPwd ? eyeOffOutline : eyeOutline} onClick={() => setShWifiPwd(!shWifiPwd)}></IonIcon>
            </IonItem>
          </div>


          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={mapOutline} /></span><span className="mc-card-title">APRS Symbol</span></div>
              <div>
                <IonButton size="small" fill="outline" color='success' onClick={() => setAprsSymbols()}>
                  <IonIcon icon={checkmarkCircle} ></IonIcon>
                </IonButton>
              </div>
            </div>

            <div className="mc-field-label">APRS Map Symbol Preset:</div>

            <IonItem>
              <IonSelect interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="APRS Symbol" onIonChange={(ev) => aprsSymChanged(ev.detail.value)}>
                {aprs_symbols_mapped.current.map((sym) => (
                  <IonSelectOption key={sym.s_name} value={sym.s_name}>
                    {sym.s_name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <div className="mc-field-label">Symbol Group Char</div>
            <IonItem>
              <IonInput value={aprs_settings_s.SYMID} ref={aprs_pri_sec_char_Input_ref} onIonInput={(ev) => aprsPriSecChangedManual(ev)} label='Set Group Character' labelPlacement="floating" type='text' maxlength={1}></IonInput>
            </IonItem>
            <div className="mc-field-label">Symbol Char</div>
            <IonItem>
              <IonInput value={aprs_settings_s.SYMCD} ref={aprs_sym_char_Input_ref} onIonInput={(ev) => aprsSymChangedManual(ev)} label='Set Character' labelPlacement="floating" type='text' maxlength={1}></IonInput>
            </IonItem>
            </div>


          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={chatboxOutline} /></span><span className="mc-card-title">APRS Comment</span></div>
              <div className='rst-set-btns'>
                <div>
                  <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_APRS_COMMENT")}>RST</IonButton>
                </div>
                <div>
                  <IonButton size="small" fill="outline" color='success' onClick={() => setAPRScomment()}>
                    <IonIcon icon={checkmarkCircle} ></IonIcon>
                  </IonButton>
                </div>
              </div>
            </div>
            <IonItem>
              <IonInput value={aprs_settings_s.ATXT} ref={aprsCmtRef} label='Set Comment' labelPlacement="floating" type='text' maxlength={MAX_APRS_CMT_CHARS}></IonInput>
            </IonItem>
          </div>


          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={pricetagOutline} /></span><span className="mc-card-title">APRS Name</span></div>
              <div>
                <div className='rst-set-btns'>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_APRS_NAME")}>RST</IonButton>
                  </div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setNameSetting()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
              </div>
            </div>
            <IonItem>
              <IonInput
                ref={name_input_ref}
                value={aprs_settings_s.NAME}
                label='Set APRS Name'
                labelPlacement="floating"
                type='text'
                maxlength={MAX_NAME_CHARS}
              ></IonInput>
            </IonItem>
          </div>


          <div className='mc-card'>
            <div className="mc-card-head mc-split">
              <div className="mc-title"><span className="mc-icon"><IonIcon icon={bluetoothOutline} /></span><span className="mc-card-title">Custom BLE PIN 6 Digits</span></div>
              <div className='rst-set-btns'>
                <IonButton size="small" fill="outline" color='success' onClick={() => resetBLEPin()}>RST</IonButton>
                <IonButton size="small" fill="outline" color='success' onClick={() => setBLEParingPin()}>
                  <IonIcon icon={checkmarkCircle} ></IonIcon>
                </IonButton>
              </div>
            </div>
            <IonItem>
              <IonInput value={ble_pairing_pin_display} ref={ble_pairing_pin_ref} label='Set BLE Pin' labelPlacement="floating" type='text' maxlength={6} inputmode="numeric" onIonInput={(ev) => handleBLEParingPinInput(ev.detail.value!)}></IonInput>
            </IonItem>
          </div>

          <div>
            <IonButton className="mc-action" expand="block" fill='outline' slot='start' onClick={() => setCurrentPosGPS()}>Set Location - Phone GPS</IonButton>
          </div>

          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShTimeZone(!shTimeZone)}>
              <div className="mc-icon"><IonIcon icon={timeOutline} /></div>
              <div className="mc-card-title">Node Time Zone</div>
              <IonIcon className="mc-fold-chev" icon={shTimeZone ? chevronDown : chevronForward} />
            </div>
            {shTimeZone &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">{tzSupported ? "Rule or fixed offset" : "Fixed UTC offset"}</span></div>
                  <div className='rst-set-btns'>
                    <IonButton size="small" fill="outline" color='success' onClick={() => resetTime()}>RST</IonButton>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setTime()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>

                {tzSupported && <>
                  <div className="mc-field-label">Time Zone Preset:</div>
                  <IonItem>
                    <IonSelect value={findTzPreset(tzText)?.id} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Time Zone" onIonChange={(ev) => tzPresetChanged(ev.detail.value)}>
                      {TZ_PRESETS.map((p) => (
                        <IonSelectOption key={p.id} value={p.id}>
                          {p.label}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <div className="mc-field-label">Time Zone Rule (POSIX), changes summer / winter time automatically:</div>
                  <IonItem>
                    <IonInput value={tzText} onIonInput={(ev) => tzTextChanged((ev.detail.value ?? "").toString())} label='Set Time Zone' labelPlacement="floating" placeholder="CET-1CEST,M3.5.0,M10.5.0/3" type='text' maxlength={MAX_TZ_CHARS}></IonInput>
                  </IonItem>
                  <div className="mc-field-label">or a fixed UTC offset, this disables the automatic time change:</div>
                </>}
                <IonItem>
                  <IonInput value={utcText} onIonInput={(ev) => utcTextChanged((ev.detail.value ?? "").toString())} label='Set UTC Offset' labelPlacement="floating" type='text' maxlength={5}></IonInput>
                </IonItem>
                {tzSupported && tzActive && <div className="mc-field-label">
                  Automatic time change active, the offset comes from the time zone rule.
                </div>}
                {tzSupported && !tzActive && nodeSettings.UTCOF !== 0 && <div className="mc-field-label">
                  Fixed offset, no automatic time change.
                </div>}
              </div>}
          </div>

            {/*Manual Position Settings*/}
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShManualPos(!shManualPos)}>
              <div className="mc-icon"><IonIcon icon={locationOutline} /></div>
              <div className="mc-card-title">Manual Location</div>
              <IonIcon className="mc-fold-chev" icon={shManualPos ? chevronDown : chevronForward} />
            </div>
            {shManualPos &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Latitude</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setManualPos()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={ownPosData.LAT} ref={manual_lat_ref} label='Set Latitude' labelPlacement="floating" type='text' maxlength={10} inputmode="text"></IonInput>
                </IonItem>
                <div className="mc-field-label">Longitude</div>
                    <IonItem>
                      <IonInput value={ownPosData.LON} ref={manual_lon_ref} label='Set Longitude' labelPlacement="floating" type='text' maxlength={11} inputmode="text"></IonInput>
                    </IonItem>
                <div className="mc-field-label">Altitude (m)</div>
                    <IonItem>
                      <IonInput value={ownPosData.ALT} ref={manual_alt_ref} label='Set Altitude' labelPlacement="floating" type='text' maxlength={6} inputmode="text"></IonInput>
                    </IonItem>
              </div>
            }
          </div>

          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShCtrySetting(!shCtrySetting)}>
              <div className="mc-icon"><IonIcon icon={globeOutline} /></div>
              <div className="mc-card-title">Country Setting</div>
              <IonIcon className="mc-fold-chev" icon={shCtrySetting ? chevronDown : chevronForward} />
            </div>
            {shCtrySetting && 
              <IonItem>
              <IonSelect value={ctrySetting} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Country" onIonChange={(ev) => setCtryNode(ev.detail.value)}>
                {ctry_list.map((ctry) => (
                  <IonSelectOption key={ctry} value={ctry}>
                    {ctry_list_translated[ctry]}
                  </IonSelectOption>
                ))}
                
              </IonSelect>
              <IonButton size="small" fill="solid" color='success' onClick={() => setCountrySetting()}>
                  <IonIcon icon={checkmarkCircle} ></IonIcon>
                </IonButton><br></br>
            </IonItem>
            }
          </div>

          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShGroupCallSet(!shGroupCallSet)}>
              <div className="mc-icon"><IonIcon icon={peopleOutline} /></div>
              <div className="mc-card-title">Group Subscription</div>
              <IonIcon className="mc-fold-chev" icon={shGroupCallSet ? chevronDown : chevronForward} />
            </div>
            {shGroupCallSet &&
              <div className='mc-card'>
                <div className="mc-field-label">Group 1</div>
                <IonItem>
                  <IonInput value={grp0} onIonInput={(ev) => grp0Changed(ev)} label='Set Group 1' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-field-label">Group 2</div>
                <IonItem>
                  <IonInput value={grp1} onIonInput={(ev) => grp1Changed(ev)} label='Set Group 2' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-field-label">Group 3</div>
                <IonItem>
                  <IonInput value={grp2} onIonInput={(ev) => grp2Changed(ev)} label='Set Group 3' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-field-label">Group 4</div>
                <IonItem>
                  <IonInput value={grp3} onIonInput={(ev) => grp3Changed(ev)} label='Set Group 4' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-field-label">Group 5</div>
                <IonItem>
                  <IonInput value={grp4} onIonInput={(ev) => grp4Changed(ev)} label='Set Group 5' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-field-label">Group 6</div>
                <IonItem>
                  <IonInput value={grp5} onIonInput={(ev) => grp5Changed(ev)} label='Set Group 6' labelPlacement="floating" type='number' maxlength={5} inputmode="numeric"></IonInput>
                </IonItem>
                <div className='resetGrpBtn txt-left flex-row'>
                    <IonButton fill='outline' slot='start' size="small" color='success' onClick={() => resetGrpCall()}>RST</IonButton>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setGroupSettings()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                </div>
              </div>
            }
          </div>

          
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShUserBtns(!shUserBtns)}>
              <div className="mc-icon"><IonIcon icon={toggleOutline} /></div>
              <div className="mc-card-title">User Buttons</div>
              <IonIcon className="mc-fold-chev" icon={shUserBtns ? chevronDown : chevronForward} />
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
                    <IonButton expand="block" fill={nodeInfo_s.BOOST ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("rxboost")}>RX Gain Boost</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={nodeSettings.WS ? 'solid' : 'outline'} onClick={() => sendTxtCmd("websrv")}>Webserver</IonButton>
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
                    <IonButton expand="block" fill={nodeSettings.NOALL ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("no_allmsg_rx")}>No ALL Msgs</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.button_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("button")}>BUTTON</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={wifiSettings_s.AP ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("wifi_ap")}>Wifi AP</IonButton>
                  </div>

                </div>
              </div>

              <div className="mc-section-title">GPS - Position</div>
              <div className='settings_btns'>
                <div className='settings_btns_l'>
                  <div >
                    <IonButton expand="block" fill={config_s.gps_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("gps")}>GPS</IonButton>
                  </div>
                  <div >
                    <IonButton expand="block" fill={config_s.track_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("track")}>TRACK</IonButton>
                  </div>
                </div>
                <div className='settings_btns_r'>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={handleSendPos}>Send POS</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("posdebug")}>POS-Info</IonButton>
                  </div>
                </div>
              </div>

              <div className="mc-section-title">Utilities</div>
              <div className='settings_btns'>
                <div className='settings_btns_l'>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("scani2c")}>Scan I2C</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => handleOTAUpdate()}>OTA Update</IonButton>
                  </div>
                </div>
                <div className='settings_btns_r'>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => setShRebootCard(true)}>REBOOT</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => setShDeepSleepCard(true)}>Deep Sleep</IonButton>
                  </div>
                </div>

              </div>

              {nodeSettingsS1_s.KISS !== undefined && <>
                <div className="mc-section-title">KISS Interface</div>
                <div className='settings_btns'>
                  <div className='settings_btns_l'>
                    <div>
                      <IonButton expand="block" fill={(nodeSettingsS1_s.KISS & 1) ? 'solid' : 'outline'} slot='start' onClick={() => sendNetToggle("kiss", !!(nodeSettingsS1_s.KISS! & 1))}>KISS</IonButton>
                    </div>
                    <div>
                      <IonButton expand="block" fill={(nodeSettingsS1_s.KISS & 2) ? 'solid' : 'outline'} slot='start' onClick={() => sendNetToggle("kiss tx", !!(nodeSettingsS1_s.KISS! & 2))}>TX</IonButton>
                    </div>
                  </div>
                  <div className='settings_btns_r'>
                    <div>
                      <IonButton expand="block" fill={(nodeSettingsS1_s.KISS & 4) ? 'solid' : 'outline'} slot='start' onClick={() => sendNetToggle("kiss meta", !!(nodeSettingsS1_s.KISS! & 4))}>RxMeta</IonButton>
                    </div>
                    <div>
                      <IonButton expand="block" fill={(nodeSettingsS1_s.KISS & 8) ? 'solid' : 'outline'} slot='start' onClick={() => kissAuthPressed(!!(nodeSettingsS1_s.KISS! & 8))}>Auth</IonButton>
                    </div>
                  </div>
                </div>
              </>}
            </> : <></>}
          </div>

          


          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShTxPwrSlider(!shTxPwrSlider)}>
              <div className="mc-icon"><IonIcon icon={flashOutline} /></div>
              <div className="mc-card-title">TX-Power</div>
              <IonIcon className="mc-fold-chev" icon={shTxPwrSlider ? chevronDown : chevronForward} />
            </div>
            {shTxPwrSlider ? <>
              <div className='ionrange_box'>
                <IonRange value={tx_pwr.current} min={minTXpwr.current} max={maxTXpwr.current} pin={true} debounce={350} pinFormatter={(value: number) => `${value} dBm`}
                  onIonChange={({ detail }) => setTxpower_slider(detail.value)}></IonRange>
                <IonLabel>Tx-Pwr: {tx_pwr.current} dBm / {tx_pwr_w}mW ({tx_pwr_pct}%)</IonLabel>
              </div>
            </> : <></>}
          </div>

          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShGwServerSet(!shGwServerSet)}>
              <div className="mc-icon"><IonIcon icon={serverOutline} /></div>
              <div className="mc-card-title">Gateway Server</div>
              <IonIcon className="mc-fold-chev" icon={shGwServerSet ? chevronDown : chevronForward} />
            </div>
            {shGwServerSet && 
              <IonItem>
              <IonSelect value={gw_srv} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="GWSrv" onIonChange={(ev) => setGwServerNode(ev.detail.value)}>
                {gw_srv_list.map((srv) => (
                  <IonSelectOption key={srv} value={srv}>
                    {gw_srv_table[srv]}
                  </IonSelectOption>
                ))}
                
              </IonSelect>
              <IonButton size="small" fill="solid" color='success' onClick={() => setGWsrvToNode()}>
                  <IonIcon icon={checkmarkCircle} ></IonIcon>
                </IonButton><br></br>
            </IonItem>
            }
          </div>


          {nodeSettingsS1_s.MHOP !== undefined && <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShMaxHop(!shMaxHop)}>
              <div className="mc-icon"><IonIcon icon={gitBranchOutline} /></div>
              <div className="mc-card-title">Max Hop</div>
              <IonIcon className="mc-fold-chev" icon={shMaxHop ? chevronDown : chevronForward} />
            </div>
            {shMaxHop &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Hop limit for text messages</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("maxhop")}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonSelect value={maxHopSel} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Max Hop" onIonChange={(ev) => setMaxHopSel(+ev.detail.value)}>
                    {maxHopOptions.map((h) => (
                      <IonSelectOption key={h} value={h}>{h}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </div>}
          </div>}


          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShHwPins(!shHwPins)}>
              <div className="mc-icon"><IonIcon icon={hardwareChipOutline} /></div>
              <div className="mc-card-title">Hardware Pins</div>
              <IonIcon className="mc-fold-chev" icon={shHwPins ? chevronDown : chevronForward} />
            </div>
            {shHwPins &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Userbutton Pin</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setUserButtonPin()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={userBtnNr.current} ref={userBtnInputRef} label='Set Userbutton Pin' labelPlacement="floating" type='number' maxlength={2} inputmode="numeric"></IonInput>
                </IonItem>
                <div className="mc-card-head mc-split mc-sub">
                  <div className="mc-title"><span className="mc-card-title">OneWire Pin</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setOnewirePin()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={owPinNr.current} ref={owPinInputRef} label='Set Onewire Pin' labelPlacement="floating" type='number' maxlength={2} inputmode="numeric"></IonInput>
                </IonItem>
              </div>
            }
          </div>

          {/*Sensor Settings: sensor buttons and the settings that belong to the sensors*/}
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShSensorSet(!shSensorSet)}>
              <div className="mc-icon"><IonIcon icon={thermometerOutline} /></div>
              <div className="mc-card-title">Sensor Settings</div>
              <IonIcon className="mc-fold-chev" icon={shSensorSet ? chevronDown : chevronForward} />
            </div>
            {shSensorSet && <>
              <div className='settings_btns'>
                <div className='settings_btns_l'>
                  <div>
                    <IonButton expand="block" fill={config_s.bme_on ? 'solid' : 'outline'} slot='start' color={bme280_color} onClick={() => sendTxtCmd("bme")}>BME280</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.bme680_on ? 'solid' : 'outline'} slot='start' color={bme680_color} onClick={() => sendTxtCmd("680")}>BME680</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={sensorSettings_s.AHT ? 'solid' : 'outline'} slot='start' color={aht20_color} onClick={() => sendTxtCmd("aht20")}>AHT-20</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.onewire_on ? 'solid' : 'outline'} slot='start' color={onewire_color} onClick={() => sendTxtCmd("owon")}>One Wire</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("wx")}>Sensor Info</IonButton>
                  </div>
                </div>
                <div className='settings_btns_r'>
                  <div>
                    <IonButton expand="block" fill={config_s.bmp_on ? 'solid' : 'outline'} slot='start' color={bmp280_color} onClick={() => sendTxtCmd("bmp")}>BMP280</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={sensorSettings_s.BMP3 ? 'solid' : 'outline'} slot='start' color={bmp3_color} onClick={() => sendTxtCmd("bmp3")}>BMP390</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.mcu811_on ? 'solid' : 'outline'} slot='start' color={s811_color} onClick={() => sendTxtCmd("mcu811")}>MCU-811</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={config_s.lps33_on ? 'solid' : 'outline'} slot='start' onClick={() => sendTxtCmd("lps33")}>LPS33</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill={sensorSettingsS1_s.SHT ? 'solid' : 'outline'} slot='start' color={sht21_color} onClick={() => sendTxtCmd("sht21")}>SHT21</IonButton>
                  </div>
                  <div>
                    <IonButton expand="block" fill='outline' slot='start' onClick={() => sendTxtCmd("scani2c")}>Scan I2C</IonButton>
                  </div>
                </div>
              </div>

              {/*Temperature Offset Settings*/}
          <div className='mc-fold' style={{ marginTop: 20 }}>
            <div className='mc-fold-head' onClick={() => setShTempOffset(!shTempOffset)}>
              <div className="mc-icon"><IonIcon icon={thermometerOutline} /></div>
              <div className="mc-card-title">Temperature Offset</div>
              <IonIcon className="mc-fold-chev" icon={shTempOffset ? chevronDown : chevronForward} />
            </div>
            {shTempOffset &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">BME/BMP Offset</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setTempOffset()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={wxData_s.TOFFI} ref={temp_offset_ref} label='Set BME/BMP Offset' labelPlacement="floating" type='text' maxlength={5} inputmode="text"></IonInput>
                </IonItem>
                <div className="mc-field-label">Onewire Offset</div>
                    <IonItem>
                      <IonInput value={wxData_s.TOFFO} ref={temp_ow_offset_ref} label='Set Onewire Offset' labelPlacement="floating" type='text' maxlength={5} inputmode="text"></IonInput>
                    </IonItem>
              </div>
              
            }
          </div>

              {/*INA226 current sensor*/}
          {inaSupported && <div className='mc-fold' style={{ marginTop: 20 }}>
            <div className='mc-fold-head' onClick={() => setShIna(!shIna)}>
              <div className="mc-icon"><IonIcon icon={flashOutline} /></div>
              <div className="mc-card-title">INA226</div>
              <IonIcon className="mc-fold-chev" icon={shIna ? chevronDown : chevronForward} />
            </div>
            {shIna &&
              <div className='mc-card'>
                <div className="mc-field-label">{sensorSettingsS1_s["226F"] ? "INA226 found on the I2C bus, it is active." : "No INA226 found on the I2C bus. The node detects it at start-up."}</div>

                <div className="mc-card-head mc-split" style={{ marginTop: 20 }}>
                  <div className="mc-title"><span className="mc-card-title">Measurement</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setIna226()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <div className="mc-field-label">Shunt in Ohm ({INA_SHUNT_MIN} - {INA_SHUNT_MAX})</div>
                <IonItem>
                  <IonInput value={inaShuntText} onIonInput={(ev) => setInaShuntText((ev.detail.value ?? "").toString())} label='Set Shunt' labelPlacement="floating" type='text' maxlength={7} inputmode="decimal"></IonInput>
                </IonItem>
                <div className="mc-field-label">Max. current in A (0 - {INA_IMAX_MAX})</div>
                <IonItem>
                  <IonInput value={inaImaxText} onIonInput={(ev) => setInaImaxText((ev.detail.value ?? "").toString())} label='Set Max. Current' labelPlacement="floating" type='text' maxlength={5} inputmode="decimal"></IonInput>
                </IonItem>
                <div className="mc-field-label">Averaged samples</div>
                <IonItem>
                  <IonSelect value={inaSampSel} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Samples" onIonChange={(ev) => setInaSampSel(+ev.detail.value)}>
                    {INA_SAMPLES.map((v) => (
                      <IonSelectOption key={v} value={v}>{inaSampleLabel(v)}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </div>}
          </div>}
            </>}
          </div>


          {isSingleCellMaxV(nodeInfo_s.MAXV) && <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShMaxV(!shMaxV)}>
              <div className="mc-icon"><IonIcon icon={flashOutline} /></div>
              <div className="mc-card-title">Max. Battery Voltage</div>
              <IonIcon className="mc-fold-chev" icon={shMaxV ? chevronDown : chevronForward} />
            </div>
            {shMaxV &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Full charge voltage ({MAXV_MIN} - {MAXV_MAX} V)</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setMaxVoltage()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={maxVText} onIonInput={(ev) => setMaxVText((ev.detail.value ?? "").toString())} label='Set Max. Voltage' labelPlacement="floating" type='text' maxlength={5} inputmode="decimal"></IonInput>
                </IonItem>
              </div>}
          </div>}


          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShFixedIPSet(!shFixedIPSet)}>
              <div className="mc-icon"><IonIcon icon={gitNetworkOutline} /></div>
              <div className="mc-card-title">Fixed IP Settings</div>
              <IonIcon className="mc-fold-chev" icon={shFixedIPSet ? chevronDown : chevronForward} />
            </div>
            {shFixedIPSet &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">IP Address</span></div>
                  <div className='rst-set-btns'>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_FIXED_IP")}>RST</IonButton>
                    </div>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => setFixedIP()}>
                        <IonIcon icon={checkmarkCircle} ></IonIcon>
                      </IonButton>
                    </div>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.OWNIP} ref={ip_addr_ref} label='Set IP Adress' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
                <div className="mc-field-label">Subnet Mask</div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.OWNMS} ref={ip_snm_ref} label='Set NMS' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
                <div className="mc-field-label">Gateway</div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.OWNGW} ref={ip_gw_ref} label='Set Gateway' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
                <div className="mc-field-label">DNS</div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.OWNDNS} ref={ip_dns_ref} label='Set DNS' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
                <div className="mc-field-label">NTP (Optional leave empty)</div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.OWNNTP === "none" ? "" : wifiSettings2_s.OWNNTP} ref={ip_ntp_ref} label='Set NTP' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
              </div>
            }
          </div>

          {/*ext. UDP Settings with one toggle to switch on/off and a text input for the ip address*/}
          {nodeSettingsS1_s.MTU !== undefined && <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShMtu(!shMtu)}>
              <div className="mc-icon"><IonIcon icon={gitNetworkOutline} /></div>
              <div className="mc-card-title">IP MTU</div>
              <IonIcon className="mc-fold-chev" icon={shMtu ? chevronDown : chevronForward} />
            </div>
            {shMtu &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">IP MTU</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("mtu")}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonSelect value={mtuSel} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="MTU" onIonChange={(ev) => setMtuSel(+ev.detail.value)}>
                    {mtuOptions.map((m) => (
                      <IonSelectOption key={m.v} value={m.v}>{m.t}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </div>}
          </div>}


          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShExtUdp(!shExtUdp)}>
              <div className="mc-icon"><IonIcon icon={swapHorizontalOutline} /></div>
              <div className="mc-card-title">Ext. UDP Interface</div>
              <IonIcon className="mc-fold-chev" icon={shExtUdp ? chevronDown : chevronForward} />
            </div>
            {shExtUdp && <>
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">UDP Dest. Addr.</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setExtUdpIP()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={wifiSettings2_s.EUDPIP} ref={ext_udp_ip_ref} label='Set UDP IP' labelPlacement="floating" type='text' maxlength={15}></IonInput>
                </IonItem>
                <IonItem>
                  <IonToggle enableOnOffLabels={true} checked={wifiSettings2_s.EUDP} onIonChange={(ev) => enableExtUDP(ev)}>Enable</IonToggle>
                </IonItem>
              </div>
            </>}
          </div>

          {nodeSettingsS1_s.NCON !== undefined && <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShNetcon(!shNetcon)}>
              <div className="mc-icon"><IonIcon icon={terminalOutline} /></div>
              <div className="mc-card-title">Remote Netconsole</div>
              <IonIcon className="mc-fold-chev" icon={shNetcon ? chevronDown : chevronForward} />
            </div>
            {shNetcon &&
              <div className='mc-card'>
                <div className="mc-field-label">The netconsole is reachable on port 2323 of the node.</div>
                <IonItem>
                  <IonToggle enableOnOffLabels={true} checked={!!nodeSettingsS1_s.NCON} onIonChange={(ev) => { if (ev.detail.checked !== !!nodeSettingsS1_s.NCON) sendNetToggle("netconsole", !ev.detail.checked); }}>Enable</IonToggle>
                </IonItem>
                <div className="mc-card-head mc-split" style={{ marginTop: 20 }}>
                  <div className="mc-title"><span className="mc-card-title">Password</span></div>
                  <div className='rst-set-btns'>
                    <IonButton size="small" fill="outline" color='success' onClick={() => resetNetPassword()}>RST</IonButton>
                    <IonButton size="small" fill="outline" color='success' onClick={() => setNetPassword()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={netPwdText} onIonInput={(ev) => setNetPwdText((ev.detail.value ?? "").toString())} label='Set Password' labelPlacement="floating" placeholder='PWD' type={shNetPwd ? 'text' : 'password'} maxlength={MAX_NET_PWD_CHARS}></IonInput>
                  <IonIcon slot='end' icon={shNetPwd ? eyeOffOutline : eyeOutline} onClick={() => setShNetPwd(!shNetPwd)}></IonIcon>
                </IonItem>
                <div className="mc-field-label">The password is also used for the KISS auth. The node does not show it, you can only set or reset it.</div>
              </div>}
          </div>}

          {/*Manual Routing (via) Settings with a destination callsign input and a toggle to switch on/off*/}
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShManRouting(!shManRouting)}>
              <div className="mc-icon"><IonIcon icon={gitBranchOutline} /></div>
              <div className="mc-card-title">Manual Routing (VIA)</div>
              <IonIcon className="mc-fold-chev" icon={shManRouting ? chevronDown : chevronForward} />
            </div>
            {shManRouting && nodeSettingsS1_s.TYP !== "SN1" && <>
              <div className='mc-card'>
                <IonText>Manual Route Settings not provided by node. Check FW Update or Re-Connect</IonText>
              </div>
            </>}
            {shManRouting && nodeSettingsS1_s.TYP === "SN1" && <>
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Destination Call</span></div>
                  <div className='rst-set-btns'>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_VIA")}>RST</IonButton>
                    </div>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => setViaCall()}>
                        <IonIcon icon={checkmarkCircle} ></IonIcon>
                      </IonButton>
                    </div>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={nodeSettingsS1_s.VIACALL} ref={via_call_ref} label='Set Dest. Call' labelPlacement="floating" placeholder="eg. OE1KFR-12" type='text' maxlength={MAX_CALLSIGN_LEN}></IonInput>
                </IonItem>
                <IonItem>
                  <IonToggle enableOnOffLabels={true} checked={nodeSettingsS1_s.VIA} onIonChange={(ev) => enableVia(ev)}>Enable</IonToggle>
                </IonItem>
              </div>
            </>}
          </div>


          {/*Web UI Password dropdown: set or reset, current value comes from SN1 (empty with older firmware)*/}
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShWebPwdSect(!shWebPwdSect)}>
              <div className="mc-icon"><IonIcon icon={keyOutline} /></div>
              <div className="mc-card-title">Web UI Password</div>
              <IonIcon className="mc-fold-chev" icon={shWebPwdSect ? chevronDown : chevronForward} />
            </div>
            {shWebPwdSect && <>
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Password</span></div>
                  <div className='rst-set-btns'>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("RST_WEBPWD")}>RST</IonButton>
                    </div>
                    <div>
                      <IonButton size="small" fill="outline" color='success' onClick={() => setWebPwd()}>
                        <IonIcon icon={checkmarkCircle} ></IonIcon>
                      </IonButton>
                    </div>
                  </div>
                </div>
                <IonItem>
                  <IonInput ref={webpwd_ref} value={nodeSettingsS1_s.WSPWD ?? ""} label='Set Web Password' labelPlacement="floating" placeholder='PWD' type={shWebPwd ? 'text' : 'password'} maxlength={MAX_WEBPWD_LEN}></IonInput>
                  <IonIcon slot='end' icon={shWebPwd ? eyeOffOutline : eyeOutline} onClick={() => setShWebPwd(!shWebPwd)}></IonIcon>
                </IonItem>
              </div>
            </>}
          </div>


          {/*Manual Command: any node command, must start with two hyphens*/}
          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShManualCmdSect(!shManualCmdSect)}>
              <div className="mc-icon"><IonIcon icon={terminalOutline} /></div>
              <div className="mc-card-title">Manual Command</div>
              <IonIcon className="mc-fold-chev" icon={shManualCmdSect ? chevronDown : chevronForward} />
            </div>
            {shManualCmdSect &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Command</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => sendManualCommand()}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonInput value={manualCmdText} onIonInput={(ev) => setManualCmdText((ev.detail.value ?? "").toString())} label='Command' labelPlacement="floating" placeholder='--info' type='text' autocapitalize='off' autocorrect={false} spellcheck={false} maxlength={MAX_MANUAL_CMD_BYTES}></IonInput>
                </IonItem>
              </div>}
          </div>


          {nodeSettingsS1_s.VOLT !== undefined && <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setShBattDisp(!shBattDisp)}>
              <div className="mc-icon"><IonIcon icon={flashOutline} /></div>
              <div className="mc-card-title">Battery Display</div>
              <IonIcon className="mc-fold-chev" icon={shBattDisp ? chevronDown : chevronForward} />
            </div>
            {shBattDisp &&
              <div className='mc-card'>
                <div className="mc-card-head mc-split">
                  <div className="mc-title"><span className="mc-card-title">Show on the node display</span></div>
                  <div>
                    <IonButton size="small" fill="outline" color='success' onClick={() => sendTxtCmd("battDisp")}>
                      <IonIcon icon={checkmarkCircle} ></IonIcon>
                    </IonButton>
                  </div>
                </div>
                <IonItem>
                  <IonSelect value={battDispSel} interface="action-sheet" interfaceOptions={customActionSheetOptions} placeholder="Battery Display" onIonChange={(ev) => setBattDispSel(ev.detail.value)}>
                    <IonSelectOption value="volt">Voltage</IonSelectOption>
                    <IonSelectOption value="proz">Percent</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </div>}
          </div>}


          <div className='mc-fold'>
            <div className='mc-fold-head' onClick={() => setshAdvSetting(!shAdvSetting)}>
              <div className="mc-icon"><IonIcon icon={constructOutline} /></div>
              <div className="mc-card-title">Advanced Settings</div>
              <IonIcon className="mc-fold-chev" icon={shAdvSetting ? chevronDown : chevronForward} />
            </div>
            {shAdvSetting ? <>
              <IonButton className="mc-action" expand="block" color="danger" fill='outline' slot='start' onClick={()=>deletePositions()}>Clear received nodes</IonButton>
              <IonButton className="mc-action" expand="block" color="danger" fill='outline' slot='start' onClick={()=>DataBaseService.clearTextMessages()}>Clear Text Msgs</IonButton>
              <IonButton className="mc-action" expand="block" color="danger" fill='outline' slot='start' onClick={()=>MheardStaticStore.clearMheards()}>Clear Mheards</IonButton>
              <IonButton className="mc-action" expand="block" color="danger" fill='outline' slot='start' onClick={()=>clearAllBLEPins_()}>Clear All BLE PINs</IonButton>

            </> : <></>}
            
          </div>
          <div id="setting_bottom"/>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
