import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar, 
  IonProgressBar, IonAlert, useIonViewDidEnter, isPlatform, useIonLoading, useIonViewWillEnter} from '@ionic/react';

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
import MhStore from '../store/MheardStore';


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


  const [scanDevices, setScanDevices] = useState<ScanRes[]>([]);
  const [connFlag, setConnFlag] = useState<boolean>(false);
  const [showProgrBar, setShowProgrBar] = useState<boolean>(false);

  // store device id
  const devID_s = useStoreState(DevIDStore, getDevID);

  //show set config Alert state
  const setConfAl = useStoreState(ShouldConfStore, getShouldConfStore);

  //config from sate store
  const config_s:ConfType = ConfigStore.useState(s => s.config);

  // redirect to chat if config is set
  const shRedirChat = useStoreState(RedirectChatStore, getRedirChatStore);

  // remember we loaded on startup settings screen
  const didrun = useRef<boolean>(false);

  // list of BLE devices
  const devices = useRef<ScanRes[]>([]);

  // manual disconnect ref to know if we disco ble manually
  const manual_ble_disco  = useRef<boolean>(false);
  // alert card params
  const [shDiscoCard, setShDiscoCard] = useState<boolean>(false);

  // reconnect BLE
  const MAX_RETRIES = 5;
  const RECON_TIME = 3000;
  const recon_count = useRef<number>(0);
  const recon_time = useRef<number>(RECON_TIME);
  const [shReconProgr, dismissReconProgr] = useIonLoading();
  const timerID_ref = useRef<any>(null);
  const [shStopReconBtn, setShStopReconBtn] = useState<boolean>(false);



  // send and parse message functions
  const {sendDV, sendTxtCmdNode, updateDevID, updateBLEConnected, addMsgQueue} = useBLE();
  const {parseMsg, convBARRtoStr} = useMSG();

  //const navigation = useIonRouter();
  const history = useHistory();

  // platform detection
  let pltfrm = "";

  // alertcard handling
  const [shAlertCard, setShAlertCard] = useState<boolean>(false);
  const [alHeader, setAlHeader] = useState<string>("");
  const [alMsg, setAlMsg] = useState<string>("");

  // get current AppState
  const isAppActive = AppActiveState.useState(s => s.active);

  // DB functions
  //const {getReconState, setReconState, initialized} = useSQLiteDB();


  // setup local notifications. we need to get permission from user/os first
  const getNotifyPermission = async () => {

    if((await LocalNotifications.requestPermissions()).display === 'granted'){
      console.log("Local Notification allowed");
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

 

  // on app mount we ask for local notification permission. Detect platform, DB init and clear old notifications
  useEffect(()=>{

    getNotifyPermission();

    // clear old notifications when the app loads
    clearNotifies();

    if(isPlatform('ios')){
      console.log("Running on iOS");
      pltfrm = "ios";
    }

    if(isPlatform('android')){
      console.log("Running on Android");
      pltfrm = "android";
    }

    if(isPlatform('pwa')){
      console.log("Running on pwa");
      pltfrm = "pwa";
    }

    if(isPlatform('mobileweb')){
      console.log("Running on mobileweb");
      pltfrm = "mobileweb";
    }

    if(isPlatform('desktop')){
      console.log("Running on desktop");
      pltfrm = "desktop";
    }

    // update pullstate platform
    PlatformStore.update(s => {
      s.platformState = pltfrm;
    });

  }, []);


  // when we enter screen we want to do an initial scan
  useIonViewDidEnter(() => {
    if (!didrun.current) {
      getScan();
      didrun.current = true;
    }
  });


  // actions when app goes or comes from background
  /*useEffect(() => {

    if (didrun.current = true) {
      console.log("Connect - App active: " + isAppActive);
      console.log("Recon Count: " + recon_count.current);

      DataBaseService.getReconState().then((reconstate) => {

        console.log("ReconState in DB: " + reconstate);

        if (reconstate === 1) {

          console.log("Recon active, coming from Background");
          console.log("Recon Timer: " + recon_time.current);
          console.log("Recon Count: " + recon_count.current);
          console.log("Connect Flag: " + connFlag);

          if (connFlag === false) {
            if (isAppActive) {
              history.push("/connect");
            }
            reconnectBLE(devID_s);
          }
          //clearTimeout(chat_timer);
        }
      });
    }

  }, [isAppActive]);*/



  /**
   * BLE Library Doc: https://github.com/capacitor-community/bluetooth-le
   */

  // scan BLE devices
  const getScan = async () => {

    console.log("Scanning BLE Devices");

    // if we are in reconnect state ignore scanning
    DatabaseService.getReconState().then((reconstate) => {
      if (reconstate) return;
    });

    setShowProgrBar(true);

    let scan_res: ScanRes[] = [];

    try {
      if (pltfrm === "android") {
        await BleClient.initialize({ androidNeverForLocation: true });
      }
      if (pltfrm === "ios") {
        await BleClient.initialize();
      }

      // check if BLE is enabled
      const ble_enabled = await BleClient.isEnabled();
      console.log("BLE enabled on phone: " + ble_enabled);

      if (!ble_enabled) {
        // alert that BLE is not enabled - iOS comes with alert message, check android
        console.log("BLE not enabled on phone!");

        if (pltfrm === "android") {
          setAlHeader("Bluetooth is not enabled!");
          setAlMsg("Please enable BT");
          setShAlertCard(true);
        }
      }

      // on android we need to have location services enabled to work with BLE
      if (pltfrm === "android") {
        const loc_enabled = await BleClient.isLocationEnabled();

        if (!loc_enabled) {
          console.log("Android Location Service disabled!");
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
      ).catch((error) => {
        console.log("Scan Result Error!");
        console.log(error);
      });

      setTimeout(async () => {
        await BleClient.stopLEScan();

        console.log('stopped scanning');
        setShowProgrBar(false);

        const newDev = scan_res;
        setScanDevices(newDev);

      }, 5000);
    } catch (error) {
      console.log(error);
    }
  }



  // connect to device
  const connDev = async (devID: string) => {

    console.log("Connecting DeviceID: " + devID);

    setShowProgrBar(true);

    // set devID in ConfigObject
    ConfigObject.setBleDevId(devID);

    // clear the timer if in reconnect
    if(timerID_ref.current !== null) clearTimeout(timerID_ref.current);

    try {
      // if we are connected already to a device, disco that and connect new
      if(connFlag){
        doDisco(devID);
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

      // on android check if we are bonded to the device
      /*if(pltfrm === "android"){

        const bonded = await BleClient.isBonded(devID);
        console.log("Bonded: " + bonded);

        await BleClient.createBond(devID);
      }*/

      // start notfication service - uart rx
      // check if notifications enabling is successfull. If not we are not connected or pairing was not set
      // or Pairing ran into timeout. There is no pairing check in the library

      await BleClient.startNotifications(
        devID,
        RAK_BLE_UART_SERVICE,
        RAK_BLE_UART_RXCHAR,
        (value) => {
          parseMsg(value).then((res) => {
            if (res !== undefined && 'msgTXT' in res) {
              console.log("Connect: Text Message: " + res.msgTXT);
              DatabaseService.writeTxtMsg(res);
            } 
            if (res !== undefined && 'temperature' in res) {
                console.log("Connect: Pos Msg Temperature: " + res.temperature);
                DatabaseService.writePos(res);
            }
            if (res !== undefined && 'mh_nodecall' in res) {
              console.log("Connect: Mheard Node Call: " + res.mh_nodecall);
              res.mh_nodecall = ConfigObject.getConf().CALL;
              console.log("Connect: Mheard: " + JSON.stringify(res));
              MheardStaticStore.setMhArr(res);
            }

          })}).then(() => {

        console.log('connected to device', devID);

        // update devID in BLE Hook
        updateDevID(devID);
        
        // reset reconnect state and params
        recon_time.current = RECON_TIME;
        recon_count.current = 0;
        dismissReconProgr();
        setShStopReconBtn(false);
        DatabaseService.setReconState(0);

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
        
        // finally we send a hello message to the client. It then starts sending data if any
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

        // redirect to chat
        if(isAppActive){
          history.push("/chat");
        }


      }).catch((error) => {
        
        console.log("Error on Start Notifications!");
        console.log(error);
        // connection happened so we need to to disconnect
        doDisco(devID);
        // initiate a new scan, so the user can click connect again without manual scan
        //getScan();
        dismissReconProgr();
      });

      setShowProgrBar(false);

    } catch (error: any) {
      
      console.log("Error on connect: " + error.message);

      const errmsg_str:string = error.message;

      if(errmsg_str.includes("removed pairing")){

        console.log("Error Pairing: " + errmsg_str);
        setShowProgrBar(false);
        dismissReconProgr();
        setAlHeader("Error Pairing! Remove Node from BLE Devices after Erase/Flash");
        setAlMsg(errmsg_str);
        setShAlertCard(true);
        return;
      } 
      
      if(errmsg_str.includes("timeout")){

        if(config_s.callSign === "XX0XXX-00"){

          console.log("Error Connecting: " + errmsg_str);
          setShowProgrBar(false);
          dismissReconProgr();
          setAlHeader("Error Connection! Remove Node from BLE Devices after Erase/Flash");
          setAlMsg(errmsg_str);
          setShAlertCard(true);
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
      dismissReconProgr();
      
      // try to reconnect
      console.log("Reconnecting to node!");

      DatabaseService.getReconState().then((reconstate)=>{

        if(reconstate === 1){
          if(timerID_ref.current !== null) clearTimeout(timerID_ref.current);
          reconnectBLE(devID);
        }
      });
    }
  }


  // disconnect callback
  function onDisconnect(deviceId: string) {

    // close DB connection
    //DatabaseService.closeConnection();

    console.log("Device disconnected callback");
    const newConnState = false;
    setConnFlag(newConnState);

    // set Flag in BLE Hook
    updateBLEConnected(false);

    // reset config parameter in state
    ConfigStore.update(s => {
      s.config.callSign = "XX",
      s.config.lat = 48.2098,
      s.config.lon = 16.3708,
      s.config.alt = 0
    });

    // update BLE connected state in store
    BLEconnStore.update(s => {
      s.ble_connected = false;
    });

    // BLE disconnect was not manually triggered
    if(manual_ble_disco.current === false){
      console.log("BLE client disconnected without Useraction!");

      // initial reconnect trigger
      if(connFlag === false){

        console.log("Setting Recon Active true");

        DatabaseService.setReconState(1);

        if(isAppActive){
          setShStopReconBtn(true);
          reconnectBLE(deviceId);
        }
      }
    }
    manual_ble_disco.current = false;
  }


  /**
   * Reconnects to node if connection was lost
   * @param devID BLE device ID
   */
  const reconnectBLE = (devID: string) => {
    
    recon_count.current++;
    console.log("Reconnect Tries: " + recon_count.current);

    if(isAppActive)
      history.push("/connect");

    if (connFlag === false) {
      // show progress wheel
      shReconProgr({
        message: 'Reconnecting to Node...',
        duration: 5000,
      });

      console.log("Recon Timer starts with: " + (recon_time.current / 1000) + " sec.");

      timerID_ref.current = setTimeout(async () => {

        console.log('Reconnect Timer, trying to reconnect');

        DatabaseService.getReconState().then(async (reconstate)=>{
          if(reconstate) await connDev(devID);
        }).catch((error)=>{
          console.log("Error getting Recon State: " + error);
        });
        //if(recon_active.current === true) await connDev(devID);
      }, recon_time.current);

      // widen time if connect was again unsuccessful
      if(recon_time.current >= 60000){

        if(recon_time.current >= 600000) recon_time.current = 600000;

      } else {
        recon_time.current = recon_time.current * 2;
      }
      console.log("Reconect Time set to: " + (recon_time.current / 1000) + " sec.");
      
    }
  }


  // redirect to config page if unset node
  const redirectConnect = () => {
    setShDiscoCard(false);
    history.push("/connect");
  }


  // disconnect function
  const doDisco = async (devID: string) => {

    manual_ble_disco.current = true;
    console.log("man disco state: " + manual_ble_disco.current);

    // update BLE connected state in BLE Hook
    updateBLEConnected(false);

    // update BLE connected state in store
    BLEconnStore.update(s => {
      s.ble_connected = false;
    });

    await BleClient.stopNotifications(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_RXCHAR);
    await BleClient.disconnect(devID);
    const newConnState = false;
    setConnFlag(newConnState);
    console.log('Disconnected from device', devID);

  }


  // update progr bar
  /*useEffect(()=>{
    console.log("Porgress Bar")
  }, [showProgrBar]);*/


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
  const handleBtn = (devIDBtn:string) => {

    if(!connFlag) {
      connDev(devIDBtn);
    } else {
      doDisco(devID_s);
      if(devIDBtn !== devID_s){
        connDev(devIDBtn);
      }
    }
  }


  // handle reset reconnect
  const handleReconActive = (state:boolean) => {

    console.log("Stop Recon Button pressed. State: " + state);

    DatabaseService.setReconState(0);

    if(timerID_ref.current !== null) clearTimeout(timerID_ref.current);

    dismissReconProgr();
    setShowProgrBar(false);
    setShStopReconBtn(false);

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
            message="Please set Callsign and Position!"
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
            message="Node disconnected!"
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
