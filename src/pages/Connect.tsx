import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar, 
  IonProgressBar, IonAlert, useIonViewDidEnter, isPlatform, IonLoading, IonModal,
IonButtons, IonList, IonItem, IonLabel,
useIonViewWillLeave} from '@ionic/react';

import './Connect.css';


import { useEffect, useRef, useState } from 'react';
import { BleClient, numbersToDataView, numberToUUID, ScanResult } from '@capacitor-community/bluetooth-le';
import {useBLE} from '../hooks/BleHandler';
import { useMSG } from '../hooks/MessageHandler';
import { DevIDStore } from '../store';
import { useStoreState } from 'pullstate';
import { getDevID, getRedirChatStore, getShouldConfStore, getConfigStore } from '../store/Selectors';
import { useHistory } from "react-router";
import ShouldConfStore from '../store/ShouldConfNode';
import RedirectChatStore from '../store/RedirectChat';
import PlatformStore from '../store/PlatformStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import ConfigStore from '../store/ConfStore';
import { ConfType, MheardType } from '../utils/AppInterfaces';
import { AlertCard } from '../components/AlertCard';
import AppActiveState  from '../store/AppActive';
import BLEconnStore from '../store/BLEconnected';
import DatabaseService from '../DBservices/DataBaseService';
import ConfigObject from '../utils/ConfigObject';
import MheardStaticStore from '../utils/MheardStaticStore';
import BleConfigFinish from '../store/BLEConfFin';
import UpdateFW from '../store/UpdtFW';
import { usePhoneGps } from '../utils/PhoneGps';
import DataBaseService from '../DBservices/DataBaseService';
import NotifyMsgState from '../store/NotifyMsg';
import LogS from '../utils/LogService';


export interface ScanRes {
  devName:string,
  rssi_:string,
  dev_id_:string
}


const Tab1: React.FC = () => {


    /**
   * RAK Services and Characteristics:
   * UUID OTA FW Update: 00001530-1212-efde-1523-785feabcd123
   * UUID Nordic BLE UART: 6e400001-b5a3-f393-e0a9-e50e24dcca9e
   * UUID Nordic UART RX Characteristic: 6e400003-b5a3-f393-e0a9-e50e24dcca9e
   * UUID Nordic UART TX Characteristic: 6e400002-b5a3-f393-e0a9-e50e24dcca9e
   * 
   * https://real-world-systems.com/docs/UUIDs.html
   */

  const RAK_BLE_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const RAK_BLE_UART_RXCHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  const RAK_BLE_UART_TXCHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  const LEGACY_DFU_SERVICE = '00001530-1212-efde-1523-785feabcd123';
  const BLE_WAIT_SCAN = 5000; // sleep time we wait for a scan to finish

  const [scanDevices, setScanDevices] = useState<ScanRes[]>([]);
  const ble_scan_devices = useRef<ScanRes[]>([]); // scan devices ref for reconnect etc.
  const ble_scan_ongoing = useRef<boolean>(false);  // scan ongoing flag, avoid multiple scans at once
  const isAppActive_Ref = useRef<boolean>(false);
  const [connFlag, setConnFlag] = useState<boolean>(false);
  const [showProgrBar, setShowProgrBar] = useState<boolean>(false);
  const connInProgress = useRef<boolean>(false);  // Flag to avoid multiple connect attempts


  // store device id
  //const devID_s = useStoreState(DevIDStore, getDevID);
  const [devID_s, setDevIDs] = useState<string>("");

  //show set config Alert state
  const setConfAl = ShouldConfStore.useState(s => s.shouldConf);

  //config from sate store
  const config_s:ConfType = ConfigStore.useState(s => s.config);

  // redirect to chat if config is set
  const shRedirChat = RedirectChatStore.useState(s => s.redirChat);

  // remember we loaded on startup settings screen
  const didrun = useRef<boolean>(false);

  // manual disconnect ref to know if we disco ble manually
  const manual_ble_disco  = useRef<boolean>(false);
  // alert card params
  const [shDiscoCard, setShDiscoCard] = useState<boolean>(false);

  // trigger when node finished sending config (Jsons plus Textmessages)
  const nodeConfFin = BleConfigFinish.useState(s => s.BleConfFin);
  // show loading indicator till we get the bleconfig finish state
  const [shLoadConf, setShLoadConf] = useState<boolean>(false);
  // trigger to update firmware if to old
  const updtFW = UpdateFW.useState(s => s.updatefw);

  // reconnect BLE
  const MAX_RETRIES = 15;
  const RECON_TIME = BLE_WAIT_SCAN + 2000;
  const recon_count = useRef<number>(0);
  const recon_time = useRef<number>(RECON_TIME);
  const [shReconProgr, setShReconProgr] = useState<boolean>(false);
  const timerID_ref = useRef<any>(null);
  const [shStopReconBtn, setShStopReconBtn] = useState<boolean>(false);
  const doReconnect = useRef<boolean>(false);


  // send and parse message functions
  const {sendDV, sendTxtCmdNode, updateDevID, updateBLEConnected, addMsgQueue} = useBLE();
  const {parseMsg, convBARRtoStr} = useMSG();

  // phonegps hook
  const {getGpsLocation, setCurrPosGPS} = usePhoneGps();

  //const navigation = useIonRouter();
  const history = useHistory();

  // platform detection
  const pltfrm = useRef<string>("");

  // alertcard handling
  const [shAlertCard, setShAlertCard] = useState<boolean>(false);
  const [alHeader, setAlHeader] = useState<string>("");
  const [alMsg, setAlMsg] = useState<string>("");

  // get current AppState
  const isAppActive = AppActiveState.useState(s => s.active);

  // flag that we can notify on new messages. no notify when stored messages are read on ble connect 
  const canNotify = useRef<boolean>(false);

  // remember if this page is active
  const thisPageActive = useRef<boolean>(false);



  // setup local notifications. we need to get permission from user/os first
  const getNotifyPermission = async () => {
    if((await LocalNotifications.requestPermissions()).display === 'granted'){
      LogS.log(0, "Local Notification allowed");
    }
  }

  // clear notification method
  const clearNotifies = async () => {
    const pendingNotifies = await LocalNotifications.getPending();

    if(pendingNotifies.notifications.length > 0){
      console.log("Pending Notifies: " + pendingNotifies.notifications.length);
      await LocalNotifications.cancel(pendingNotifies);
    }
  }

  // check on android if location services are enabled
  const checkLocSettingAndroid = async () => {
    console.log("Checking Location Services on Android");
    const loc_enabled = await BleClient.isLocationEnabled();
    if (!loc_enabled) {
      console.log("Android Location Service disabled!");
      // open Location settings in android
      await BleClient.openLocationSettings();
    }
  }

  

  // on app mount we ask for local notification permission. Detect platform, DB init and clear old notifications
  useEffect(()=>{

    getNotifyPermission();

    // clear old notifications when the app loads
    clearNotifies();

    if(isPlatform('ios')){
      console.log("Running on iOS");
      pltfrm.current = "ios";
    }

    if(isPlatform('android')){
      console.log("Running on Android");
      pltfrm.current = "android";
    }

    if(isPlatform('pwa')){
      console.log("Running on pwa");
      pltfrm.current = "pwa";
    }

    if(isPlatform('mobileweb')){
      console.log("Running on mobileweb");
      pltfrm.current = "mobileweb";
    }

    if(isPlatform('desktop')){
      console.log("Running on desktop");
      pltfrm.current = "desktop";
    }

    // update pullstate platform
    PlatformStore.update(s => {
      s.platformState = pltfrm.current;
    });

    if(pltfrm.current === "android"){
      // check if location services are enabled
      checkLocSettingAndroid();
    }

  }, []);


  // when we enter for the first time the screen we want to do an initial scan
  useIonViewDidEnter(() => {
    if (!didrun.current) {
      getScan();
      didrun.current = true;
    }
    // set the page active flag
    thisPageActive.current = true;
  });

  // when we leave the page we clear the page active flag
  useIonViewWillLeave(() => {
    thisPageActive.current = false;
  });


  // actions when app goes or comes from background
  useEffect(() => {
    // set REF to current state
    isAppActive_Ref.current = isAppActive;
    //App did run already and is not fresh started
    if (didrun.current) {
      console.log("Connect - App active: " + isAppActive_Ref.current);
      console.log("Recon Count: " + recon_count.current);
      LogS.log(0, "App active: " + isAppActive_Ref.current);
      // check if we are in reconnect state
      console.log("Reconnect State: " + doReconnect.current);
      if (doReconnect.current) {
        console.log("Reconnect State active!");
        // if we are in reconnect state and the app is active we start the reconnect timer
        if (isAppActive_Ref.current) {
          /**
           * RECONNECT DISABLED !!!!
           */
          //reconnectBLE(ConfigObject.getBleDevId());
        }
      }
    }
  }, [isAppActive]);


  // async timeout function for BLE scan
  const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * BLE Library Doc: https://github.com/capacitor-community/bluetooth-le
   */

  // scan BLE devices
  const getScan = async () => {
    ble_scan_ongoing.current = true;
    LogS.log(0, "Scanning BLE Devices");
    // if we are in reconnect state ignore scanning
    /*DatabaseService.getReconState().then((reconstate) => {
      if (reconstate) return;
    });*/

    setShowProgrBar(true);

    let scan_res: ScanRes[] = [];

    try {
      if (pltfrm.current === "android") {
        await BleClient.initialize({ androidNeverForLocation: true });
      }
      if (pltfrm.current === "ios") {
        await BleClient.initialize();
      }

      // check if BLE is enabled
      const ble_enabled = await BleClient.isEnabled();
      LogS.log(0, "BLE enabled on phone: " + ble_enabled);

      if (!ble_enabled) {
        // alert that BLE is not enabled - iOS comes with alert message, check android
        LogS.log(1, "BLE not enabled on phone!");

        if (pltfrm.current === "android") {
          setAlHeader("Bluetooth is not enabled!");
          setAlMsg("Please enable BT");
          setShAlertCard(true);
        }
      }

      // on android we need to have location services enabled to work with BLE
      if (pltfrm.current === "android") {
        const loc_enabled = await BleClient.isLocationEnabled();

        if (!loc_enabled) {
          LogS.log(1, "Android Location Service disabled!");
          // open Location settings in android
          await BleClient.openLocationSettings();
        }
      }

      // do BLE scan. 
      let localname_str = "";

      await BleClient.requestLEScan(
        {
          services: [],
          optionalServices: [],
        },
        (result) => {
          console.log('\n----------------------------');
          console.log('received new scan result');
          console.log("Device ID: " + result.device.deviceId);

          if (result.device.name) {
            if (result.localName) {
              localname_str = result.localName!.toString();
              console.log("Local Name: " + localname_str);
            } else {
              console.log("No Local Name provided!");
            }

            let blename = result.device.name.toString();
            console.log("Device Name: " + blename);

            const ble_rssi = result.rssi!.toString();
            console.log("RSSI: " + ble_rssi);

            const manuf_data = result.manufacturerData;

            if (manuf_data) {
              console.log("Manuf Data available");

              let mkey = Object.keys(manuf_data);
              const mkey_str = mkey[0];
              console.log("MF Data Key: " + mkey_str);

              // take only mf data if key is 17229 = "MC"
              if (mkey_str === "17229") {
                let mval = manuf_data[mkey_str];

                let mf_call_arr: number[] = [];
                console.log("Buffer bytelen: " + mval.buffer.byteLength);
                let mf_call_str = "";

                for (let i = 0; i < mval.buffer.byteLength; i++) {
                  mf_call_arr[i] = mval.getInt8(i);
                }

                mf_call_str = convBARRtoStr(mf_call_arr);
                console.log("MF Call: " + mf_call_str);
                blename = mf_call_str;
              }

            }

            const newScanRes: ScanRes = {
              devName: blename,
              rssi_: ble_rssi,
              dev_id_: result.device.deviceId
            }

            scan_res.push(newScanRes);
            console.log("ScanRes Array Len: " + scan_res.length);
            localname_str = "";
          }
        }
      );

      // stop the scan after 5 seconds
      await sleep(BLE_WAIT_SCAN);
      await BleClient.stopLEScan();

      LogS.log(0, "Stopped Scanning");
      setShowProgrBar(false);

      // sort the scan results by their name
      scan_res.sort((a, b) => (a.devName > b.devName) ? 1 : -1);
      const newDev = scan_res;
      setScanDevices(newDev);
      ble_scan_devices.current = newDev;
      ble_scan_ongoing.current = false;
      return;

    } catch (error) {
      LogS.log(1, "Error on BLE Scan! " + error);
    }
  }



  // connect to device
  const connDev = async (devID: string) => {

    // check if we are already connecting to a device
    if (connInProgress.current) {
      LogS.log(0, "BLE Connect already in Progress!");
      return;
    }

    connInProgress.current = true;

    LogS.log(0, "Connecting DeviceID: " + devID);
    setShowProgrBar(true);
    // set devId state here local
    setDevIDs(devID);
    // set devID in ConfigObject
    ConfigObject.setBleDevId(devID);
    // clear the timer if in reconnect
    if(timerID_ref.current !== null) clearInterval(timerID_ref.current);
    // check if the DB is open. Makes new connection and opens DB if not
    try {
      await DatabaseService.checkDbConn(); 
    } catch (error) {
      LogS.log(1, "Error on DB Connection! " + error);
      setShowProgrBar(false);
      setAlHeader("Error on DB Connection!");
      const err_msg = (error as Error).message;
      setAlMsg(err_msg);
      setShAlertCard(true);
    }
    
    // check if DB state is initialized
    if(!DataBaseService.isInit){
      LogS.log(0, "BLE Connect - DB is not initialized!");
      // try to init DB again
      try {
        await DatabaseService.initializeDatabase();
      } catch (error) {
        LogS.log(1, "BLE Connect - Error on DB Initialization! " + error);
        setShowProgrBar(false);
        setAlHeader("Error on DB Initialization!");
        const err_msg = (error as Error).message;
        setAlMsg(err_msg);
        setShAlertCard(true);
      }
    } else {
      LogS.log(0, "BLE Connect - DB initialized!");
    }

    try {
      // if we are connected already to a device, disco that and connect new
      if(connFlag){
        doDisco(devID);
      }

      // make a disconnect before connecting when on android
      if(pltfrm.current === "android"){
        await BleClient.initialize();
        await BleClient.disconnect(devID);
      }

      //connect to device
      await BleClient.connect(devID, (deviceId) => onDisconnect(deviceId));
      
      //get services of the device
      const services = await BleClient.getServices(devID);

      for (let s of services) {
        console.log("Service UUID: " + s.uuid);
        // get characterstics
        for (let charact of s.characteristics) {
          console.log("Characteristic UUID: " + charact.uuid);
          for (let c of charact.descriptors)
            console.log("Descriptor UUID:: " + c.uuid);
        }
      }

      // start notfication service - uart rx
      // check if notifications enabling is successfull. If not we are not connected or pairing was not set
      // or Pairing ran into timeout. There is no pairing check in the library

      await BleClient.startNotifications(
        devID,
        RAK_BLE_UART_SERVICE,
        RAK_BLE_UART_RXCHAR,
        (value) => {
          parseMsg(value).then(async (res) => {
            if (res !== undefined && 'msgTXT' in res) {
              // escape all quotation marks
              LogS.log(0,"Connect - Txt Msg: " + res.msgTXT);
              await DatabaseService.writeTxtMsg(res);
              // do the notification if from another callsign
              const curr_call = ConfigObject.getConf().CALL;
              if (res.fromCall !== curr_call && (!res.msgTXT.startsWith("--")) && canNotify.current) {
                console.log("Connect: Notification from: " + res.fromCall);
                NotifyMsgState.update(s => {
                  s.notifyMsg = res;
                });
              }
            } 
            if (res !== undefined && 'temperature' in res) {
                console.log("Connect: Pos Msg from: " + res.callSign);
                await DatabaseService.writePos(res);
            }
            if (res !== undefined && 'mh_nodecall' in res) {
              console.log("Connect: Mheard Node Call: " + res.mh_nodecall);
              res.mh_nodecall = ConfigObject.getConf().CALL;
              MheardStaticStore.setMhArr(res);
            }

          })}).then(async () => {

        LogS.log(0, "Connected to Device: " + devID);

        // Update Recon State in DB
        await DatabaseService.setReconState(0, devID);

        // update devID in BLE Hook
        updateDevID(devID);
        
        // reset reconnect state and params
        doReconnect.current = false;
        recon_time.current = RECON_TIME;
        recon_count.current = 0;
        setShReconProgr(false);
        setShStopReconBtn(false);

        const newConnState = true;
        setConnFlag(newConnState);

        // update BLE connected state in store
        BLEconnStore.update(s => {
          s.ble_connected = newConnState;
        });

        // set state in store
        DevIDStore.update(s => {
          s.devID = devID;
        });

        // clear the MHeards - we get them new from the node
        MheardStaticStore.mhArr_s = [];

        // show the conf loading progess
        if(isAppActive)
          setShLoadConf(true);
        
        // finally we send a hello message to the client. It then starts sending data if any
        LogS.log(0, "Sending Hello Msg to Node!");
        const len_hello = 4;
        const call_buffer = new ArrayBuffer(len_hello);
        const view1 = new DataView(call_buffer);
        view1.setUint8(0, len_hello);
        view1.setUint8(1, 0x10);
        view1.setUint8(2, 0x20);
        view1.setUint8(3, 0x30);
        sendDV(view1, devID);

        // update BLE connected state in BLE Hook
        updateBLEConnected(true);
        
        setShowProgrBar(false);

      }).catch((error) => {
        
        LogS.log(1, "Error on Start Notifications! " + error);
        // connection happened so we need to to disconnect
        doDisco(devID);
        // initiate a new scan, so the user can click connect again without manual scan
        //getScan();
        setShReconProgr(false);
        // alert user
        setAlHeader("Error on Connecting to Node!");
        setAlMsg("Please reconnect to Node!");
        setShAlertCard(true);
      });

      setShowProgrBar(false);

      connInProgress.current = false;

    } catch (error: any) {
      
      LogS.log(1,"Error on connect: " + error.message);

      const errmsg_str:string = error.message;

      setShowProgrBar(false);
      setShReconProgr(false);

      if(errmsg_str.includes("removed pairing")){

        LogS.log(1,"Error Pairing: " + errmsg_str);
        setAlHeader("Error Pairing! Remove Node from BLE Devices after Erase/Flash");
        setAlMsg(errmsg_str);
        setShAlertCard(true);
        connInProgress.current = false;
        return;
      } 
      
      if(errmsg_str.includes("timeout")){

        if(config_s.callSign === "XX0XXX-00"){

          LogS.log(1,"Error Connecting: " + errmsg_str);
          setAlHeader("Error Connection! Remove Node from BLE Devices after Erase/Flash");
          setAlMsg(errmsg_str);
          setShAlertCard(true);
          connInProgress.current = false;
          return;
        } else {
          LogS.log(1,"Error Connecting: " + errmsg_str);
          setAlHeader("Error on Connection!");
          setAlMsg(errmsg_str);
          setShAlertCard(true);
          connInProgress.current = false;
          return;
        }
      } 

      // set connection flag to false
      const newConnState = false;
      setConnFlag(newConnState);

      // set Flag in BLE Hook
      updateBLEConnected(false);

      // update BLE connected state in store
      BLEconnStore.update(s => {
        s.ble_connected = false;
      });

      // set state in store
      DevIDStore.update(s => {
        s.devID = devID;
      });

      setShowProgrBar(false);
      setShReconProgr(false);
      connInProgress.current = false;
    }
  }



  // BLE disconnect callback
  async function onDisconnect(deviceId: string) {

    LogS.log(0,"Device disconnected callback from DevID: " + deviceId);
    const newConnState = false;
    setConnFlag(newConnState);

    // set Flag in BLE Hook
    updateBLEConnected(false);
    // stop the load conf indicator (disco comes always at connect after fresh flash)
    setShLoadConf(false);

    // update BLE connected state in store
    BLEconnStore.update(s => {
      s.ble_connected = false;
    });

    // reset notification flag
    canNotify.current = false;

    setShowProgrBar(false);

    // BLE disconnect was not manually triggered - Reconnect
    console.log("Manual disco state: " + manual_ble_disco.current);
    if(manual_ble_disco.current === false) {
      LogS.log(0,"BLE client disconnected without Useraction!");
      /*
      RECONNECT DISABLED !!!!!
      
      // set the recon flag
      doReconnect.current = true;
      // write to DB
      await DatabaseService.checkDbConn();
      await DatabaseService.setReconState(1, deviceId);
      setShStopReconBtn(true);
      /**
       * starting the reconnect procedure only if the app is active
       * it first scans again BLE devices in an interval and if found it connects again
       * On iOS scanning only works in background with dedicated BLE service but we don't find any devices if searching for them
       * On Android the BLE service needs to get a foreground service to do anything in background
       * So for now we only reconnect if the app is active
       * Furthermore the reconnect state is written to the DB. If the app gets active again the reconnect is triggered (not yet implemented!)
       *  
      if (isAppActive_Ref.current) {
        reconnectBLE(deviceId);
      }*/
      // alert the user that it disconnected if not manually
      if(thisPageActive.current) setShDiscoCard(true);

    } else {
      // Manual disconnect was triggered
      // reset config parameter in state
      ConfigStore.update(s => {
        s.config.callSign = "XX",
          s.config.lat = 48.2098,
          s.config.lon = 16.3708,
          s.config.alt = 0
      });
    }

    // close DB connection
    await DatabaseService.closeConnection();

    // reset ble_conf_finish state
    BleConfigFinish.update(s => {
      s.BleConfFin = 0;
    });

    // reset manual disco flag
    manual_ble_disco.current = false;
  }



  /**
   * Reconnects to node if connection was lost
   * @param devID BLE device ID
   */
  const reconnectBLE = async (devID: string) => {

    /*if(recon_count.current > MAX_RETRIES){
      console.log("Connect - Max Retries reached!");

      setAlHeader("Max Retries Reconnecting reached!");
      setAlMsg("Please reconnect to Node manually!");
      setShAlertCard(true);
      // reset recon button and recon progress
      setShReconProgr(false);
      setShStopReconBtn(false);
      setShowProgrBar(false);
      // set the flag to stop reconnect
      doReconnect.current = false;
      // close DB connection
      await DatabaseService.closeConnection();
      return;
    }*/

    recon_count.current++;
    console.log("Reconnect Tries: " + recon_count.current);

    if (isAppActive_Ref.current)
      history.push("/connect");

    if (connFlag === false) {
      // show progress wheel
      setShReconProgr(true);

      console.log("Recon Timer starts with: " + (recon_time.current / 1000) + " sec.");

      if (!ble_scan_ongoing.current) {
        timerID_ref.current = setInterval(async () => {
          console.log('Reconnect Timer, scanning for BLE devices!');
          // do a ble scan and check if the lost node is in the list
          await getScan(); // scan takes 5 sec

          // check the scan results if the lost node is in the list
          let found_node = false;
          ble_scan_devices.current.forEach((dev) => {
            if (dev.dev_id_ === devID) {
              found_node = true;
            }
          });

          if (!found_node) {
            console.log("Node not found in scan list! DeviceID: " + devID);
          } else {
            console.log("Node found in scan list! DeviceID: " + devID);
            clearInterval(timerID_ref.current);
            await connDev(devID);
          }
        }, recon_time.current);

        // widen time if connect was again unsuccessful
        /*if(recon_time.current >= 12000){
          recon_time.current = 12000;
        } else {
          recon_time.current = recon_time.current + RECON_TIME;
        }
        console.log("Reconect Time set to: " + (recon_time.current / 1000) + " sec.");*/

        return () => {
          clearInterval(timerID_ref.current);
        }
      }
    }
  }


  // handle reset reconnect triggered by button
  const handleReconActive = (state: boolean) => {
    console.log("Stop Recon Button pressed. State: " + state);

    if (timerID_ref.current !== null) clearInterval(timerID_ref.current);
    doReconnect.current = false;
    setShReconProgr(false);
    setShowProgrBar(false);
    setShStopReconBtn(false);
  }


  // redirect to config page if unset node
  const redirectConnect = () => {
    setShDiscoCard(false);
    /*if (isAppActive)
      history.push("/connect");*/
  }




  // disconnect function
  const doDisco = async (devID: string) => {

    manual_ble_disco.current = true;
    console.log("Connect Tab - Manual disco state: " + manual_ble_disco.current);

    const newConnState = false;
    setConnFlag(newConnState);
    // update BLE connected state in BLE Hook
    updateBLEConnected(false);

    // update BLE connected state in store
    BLEconnStore.update(s => {
      s.ble_connected = false;
    });

    try {
      await BleClient.stopNotifications(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_RXCHAR);
      await BleClient.disconnect(devID);
    } catch (error: any) {
      console.error("Error on Disconnect: " + error.message);
      // reboot the node if the callsign is not set. BLE Authentication Error. 
      if(config_s.callSign === "XX0XXX-00" || config_s.callSign === ""){
        // alert the user
        setAlHeader("Please set your Callsign!");
        setAlMsg("Rebooting Node to set BLE authentication!");
        setShAlertCard(true);
        console.log("Rebooting Node!");
        sendTxtCmdNode("--reboot");
      }
    }
  }




  // BLE Config Fin state
  useEffect(() => {
    if (nodeConfFin > 0) {
      console.log("Node Config Finished!");
      setShLoadConf(false);

      // get the current position from GPS and send the position to the node if unconfigured
      getGpsLocation().then((res) => {
        console.log("Connect - GPS Location: " + res.lat + " " + res.lon + " " + res.alt);
        if (config_s.callSign === "XX0XXX-00" || config_s.callSign === "") {
          console.log("Connect - Unconfigured Node!");
          // give the node a default location from phone
          if (config_s.lat === 0 && config_s.lon === 0) {
            console.log("Connect - Setting Initial Position from Phone");
            setCurrPosGPS(true);
            // delay to give the node time to save the position
            setTimeout(() => { }, 2000);
          }
        }

      }).catch((error) => {
        console.log("Connect - GPS Error: " + error);
      });

      // send a timestamp to phone via dataview. 4byte unix timestamp in seconds
      const ts = Math.trunc(Date.now() / 1000);
      console.log("Connect - sending Timestamp to Phone: " + ts);
      const len_ts = 6;
      const ts_buffer = new ArrayBuffer(len_ts);
      const view1 = new DataView(ts_buffer);
      view1.setUint8(0, len_ts);
      view1.setUint8(1, 0x20);
      view1.setInt32(2, ts, true);
      sendDV(view1, devID_s);

      // set the can notify flag to true
      canNotify.current = true;

      // redirect to chat
      if (isAppActive && !setConfAl) {
        history.push("/chat");
      }
    }
  }, [nodeConfFin]);




  // when the update firmware trigger fires we dismiss the ShLoadConf and fire the alertcard
  useEffect(()=>{
    if(updtFW){
      console.log("Update Firmware Triggered!");
      setShLoadConf(false);
      setAlHeader("Firmware Update needed!");
      setAlMsg("Please update the Firmware to 4.30 or newer!");
      setShAlertCard(true);
      // do a manual disconnect
      const devid = ConfigObject.getBleDevId();
      doDisco(devid);

      // set state in store
      UpdateFW.update(s => {
        s.updatefw = false;
      });
    }
  }, [updtFW]);




  // redirect to config page if unset node
  const redirectConfig = () => {
    ShouldConfStore.update(s => {
      s.shouldConf = false;
    });

    if(isAppActive)
      history.push("/settings");
  }




  // redirect to chat when config is set
  useEffect(()=>{
    if (shRedirChat) {
      console.log("Redirecting to Chat");

      if (isAppActive) {
        history.push("/chat");
        RedirectChatStore.update(s => {
          s.redirChat = false;
        });
      }
    }
  }, [shRedirChat]);




  // handle connect disconnect on the buttons
  const handleBtn = async (devIDBtn:string) => {
    if(!connFlag) {
      await connDev(devIDBtn);
    } else {
      await doDisco(devID_s).then(() => {
        console.log("Disco done at handleBtn!");
        // if user directly switches from a connected node to another one, we connect to the new one
        if(devIDBtn !== devID_s){
          setTimeout(async () => {
            await connDev(devIDBtn);
          }, 1500);
        }
      });
    }
  }




  return (
    <>
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Devices</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonHeader collapse="condense">
            <IonToolbar>
              <IonTitle size="large">Devices</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonAlert
            isOpen={setConfAl}
            onDidDismiss={() => redirectConfig()}
            header="Unconfigured Node!"
            message="Please set Callsign etc. and scroll to Save Settings button!"
            buttons={[
              {
                text: "OK",
                handler: (redirect) => {
                  redirectConfig();
                },
              },
            ]}
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

          <AlertCard
            isOpen={shAlertCard}
            header={alHeader}
            message={alMsg}
            onDismiss={() => setShAlertCard(false)}
          />

          <IonLoading
            isOpen={shLoadConf}
            onDidDismiss={() => setShLoadConf(false)}
            message={'Loading Config from node. Please wait...'}
            duration={20000}  // Duration in milliseconds, adjust as needed
          />

          <IonLoading
            isOpen={shReconProgr}
            onDidDismiss={() => setShReconProgr(false)}
            message={'Reconnecting to node. Please wait...'}
            duration={3000}  // Duration in milliseconds, adjust as needed
          />

          <div id="spacer-progress"></div>
          <div id="progr_bar">
            {showProgrBar ?
              <>
                <IonProgressBar type="indeterminate"></IonProgressBar>
              </> : <></>}

          </div>
          <div id="spacer-top"></div>

          <div id="ionlist">

            {shStopReconBtn ? <>
              <IonButton expand='block' size="default" fill='solid' slot='start' color='danger' onClick={() => handleReconActive(false)}>Cancel Reconnecting</IonButton>
              <div id="spacer-button"></div>
            </> : <>
              <IonButton onClick={getScan} disabled={connFlag ? true : false} expand="block">Scan BLE Devices</IonButton>
              <div id="spacer-button"></div>
            </>}

            {scanDevices.map((dev, i) => (
              <>
                <div className='buttons'>
                  {dev.dev_id_ === devID_s ? <>
                    <IonButton key={i} expand='block' size="default" fill='solid' slot='start' color={connFlag ? 'success' : 'primary'} onClick={() => handleBtn(dev.dev_id_)}>{dev.devName} | RSSI:{dev.rssi_}</IonButton>
                  </> : <>
                    <IonButton key={i} expand='block' size="default" fill='solid' slot='start' onClick={() => handleBtn(dev.dev_id_)}>{dev.devName} | RSSI:{dev.rssi_}</IonButton>
                  </>}
                </div>
              </>
            ))}

          </div>
        </IonContent>
      </IonPage>
    </>
  );
};

export default Tab1;
