import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonAlert, useIonViewDidEnter, isPlatform, IonLoading, IonModal,
IonButtons, IonList, IonItem, IonLabel, IonInput, IonIcon, IonText,
IonToggle, IonSpinner} from '@ionic/react';
import { keyOutline, trashOutline, checkmarkCircle, closeCircle, radioOutline, bluetoothOutline } from 'ionicons/icons';

import './Connect.css';


import { useEffect, useRef, useState } from 'react';
import { BleClient, numbersToDataView, numberToUUID, ScanResult } from '@capacitor-community/bluetooth-le';
import {useBLE} from '../hooks/BleHandler';
import { useMSG } from '../hooks/MessageHandler';
import { DevIDStore } from '../store';
import { useStoreState } from 'pullstate';
import { getDevID, getRedirChatStore, getShouldConfStore, getConfigStore } from '../store/Selectors';
import { useNavigate, useLocation } from "react-router-dom";
import ShouldConfStore from '../store/ShouldConfNode';
import RedirectChatStore from '../store/RedirectChat';
import PlatformStore from '../store/PlatformStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import ConfigStore from '../store/ConfStore';
import { ConfType, MheardType } from '../utils/AppInterfaces';
import { AlertCard } from '../components/AlertCard';
import { SignalBars } from '../components/SignalBars';
import { compareBleNodes, bleNodeCallsign } from '../utils/Callsign';
import { advLocalName, meshcomManufacturerName } from '../utils/BleAdvertisement';
import ScanDiagnostics from '../utils/ScanDiagnostics';
import AppActiveState  from '../store/AppActive';
import ConfigSyncWatchdog, { SyncProgress } from '../utils/ConfigSyncWatchdog';
import { ConfigSyncRetry } from '../components/ConfigSyncRetry';
import BLEconnStore from '../store/BLEconnected';
import DatabaseService from '../DBservices/DataBaseService';
import ConfigObject from '../utils/ConfigObject';
import MheardStaticStore from '../utils/MheardStaticStore';
import BleConfigFinish from '../store/BLEConfFin';
import NodeSettingsStoreS1, { defaultNodeSettingsS1 } from '../store/NodeSettingsStoreS1';
import NodeInfoStoreS1, { defaultInfoDataS1 } from '../store/NodeInfoStoreS1';
import UpdateFW from '../store/UpdtFW';
import { MIN_FW_VERSION, isFwOlderThan } from '../utils/FwVersion';
import { usePhoneGps } from '../utils/PhoneGps';
import DataBaseService from '../DBservices/DataBaseService';
import NotifyMsgState from '../store/NotifyMsg';
import LogS from '../utils/LogService';
import TimeSyncManager from '../utils/TimeSyncService';
import AutoReconnectManager, { ReconnectProbe, advertHits, trimAdvertTimes } from '../utils/AutoReconnectManager';
import ReconnectStore from '../store/ReconnectStore';
import { markConnected } from '../utils/ReconnectPersist';
import { APP_SETTING_AUTO_RECONNECT, APP_SETTING_LAST_DEVICE } from '../utils/AppSettingKeys';



export interface ScanRes {
  devName:string,
  rssi_:string,
  dev_id_:string
}

// internal live scan entry: the smoothed RSSI and when we heard the device last
interface ScanEntry {
  res: ScanRes,
  rssi: number,
  lastSeen: number,
  nameFromMf: boolean,
  recent: number[]   // arrival times of the latest adverts, for the hit rate
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
  const BLE_CONNECT_TIMEOUT = 15000; // connect timeout of a manual connect
  const REC_CONNECT_TIMEOUT = 10000; // connect timeout inside a reconnect cycle, the node was heard just before
  const ANDROID_GATT_RETRY_DELAY = 1500; // android: pause before the one silent retry of a manual connect that failed with GATT 133
  const ANDROID_POST_SCAN_DELAY = 300; // android: pause between the stop of the scan and the connect, the stack needs a moment to leave the scan
  const SCAN_REFRESH_MS = 1000; // how often the live scan publishes its results to the list
  const SCAN_STALE_MS = 20000; // a device we did not hear for this long leaves the list (some nodes advertise only every few seconds)
  const SCAN_DIAG_MS = 10000; // interval of the [SCAN] diagnostic lines in the log
  const RSSI_SMOOTHING = 0.4; // weight of a new RSSI value, the RSSI of a node jumps by some dB between packets
  const BLE_RECONNECT_DELAY = 2500; // min. ms between a BLE disconnect and the next connect (android needs time to tear down the old connection)
  const TIMESYNC_INTERVAL = 20000; // 20 seconds interval for timesync
  const SYNC_DIALOG_MIN_MS = 2000; // minimum time the config sync dialog stays on screen

  const [scanDevices, setScanDevices] = useState<ScanRes[]>([]);
  const ble_scan_devices = useRef<ScanRes[]>([]); // scan devices ref for reconnect etc.
  const ble_scan_ongoing = useRef<boolean>(false);  // scan ongoing flag, avoid multiple scans at once
  const isAppActive_Ref = useRef<boolean>(false);
  const [connFlag, setConnFlag] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);  // connect attempt running (until the setup is done or failed)
  const connInProgress = useRef<boolean>(false);  // Flag to avoid multiple connect attempts
  const bleConnT0 = useRef<number | null>(null);  // start time of the last connect attempt (BLE diagnostics)
  const lastBleDiscoTs = useRef<number | null>(null);  // time of the last BLE disconnect, used for the reconnect delay
  const ble_scan_devices_filtered = useRef<ScanRes[]>([]); // filtered scan devices for MC only

  // live scan: results are collected in a map by device ID and published to the list once a second
  const scan_map = useRef<Map<string, ScanEntry>>(new Map());
  const scan_running = useRef<boolean>(false);
  const scan_refresh_timer = useRef<number | null>(null);
  const scan_diag = useRef<ScanDiagnostics>(new ScanDiagnostics());  // counts the adverts of the MeshCom nodes
  const scan_diag_timer = useRef<number | null>(null);
  const scan_queue = useRef<Promise<void>>(Promise.resolve());  // start and stop run one after the other
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const showMConly_ref = useRef<boolean>(true);

  // the scan only runs while the Connect tab is shown, see the scan effect
  const location = useLocation();
  const pageActive = location.pathname.replace(/\/+$/, "") === "/connect";
  const pageActive_ref = useRef<boolean>(pageActive);
  pageActive_ref.current = pageActive;


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

  // trigger when node finished sending config (Jsons plus Textmessages)
  const nodeConfFin = BleConfigFinish.useState(s => s.BleConfFin);
  // show loading indicator till we get the bleconfig finish state
  const [shLoadConf, setShLoadConf] = useState<boolean>(false);
  // progress of the config sync watchdog, shown while missing config data is requested again
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  // the sync dialog stays at least SYNC_DIALOG_MIN_MS on screen, so the user can read it
  const syncShownAt = useRef<number | null>(null);
  const syncHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CONFFIN arrived while the app was in the background, we go to the chat when it comes back
  const confFinInBackground = useRef<boolean>(false);

  // auto reconnect. wasConnected: we were fully connected to a node (set after the setup, reset on disconnect).
  // Only the loss of such a connection starts a reconnect cycle, a connect that failed does not.
  const wasConnected = useRef<boolean>(false);
  // the link was lost, or a running cycle was stopped, while the app was in the background: the cycle starts when it comes back
  const pendingReconnect = useRef<boolean>(false);
  // the silent connect used by the reconnect cycle. Replaced on every render, so the callback registered
  // once at mount always calls the current one
  const reconnectConnectFn = useRef<(devID: string) => Promise<boolean>>(async () => false);
  const recState = ReconnectStore.useState(s => s.state);
  const recEnabled = ReconnectStore.useState(s => s.enabled);
  const recColdStart = ReconnectStore.useState(s => s.coldStartPending);
  const recResult = ReconnectStore.useState(s => s.lastResult);


  // send and parse message functions
  const {sendDV, sendTxtCmdNode, updateDevID, updateBLEConnected, syncTimestampToDevice} = useBLE();
  const {parseMsg, convBARRtoStr, resetNodeCall} = useMSG();

  // phonegps hook
  const {getGpsLocation, setCurrPosGPS} = usePhoneGps();

  const navigate = useNavigate();

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


  // Toggle for MC only Devices to filter at BLE scan
  const [showMConly, setShowMConly] = useState<boolean>(true);

  // PIN management modal
  const [shPinModal, setShPinModal] = useState<boolean>(false);
  const pinModalDevice = useRef<ScanRes | null>(null);
  const [pinModalCurrentPin, setPinModalCurrentPin] = useState<string>("");
  const [pinInputVal, setPinInputVal] = useState<string>("");



  // setup local notifications. we need to get permission from user/os first
  const getNotifyPermission = async () => {
    if((await LocalNotifications.requestPermissions()).display === 'granted'){
      LogS.log(0, "Local Notification allowed");
      // create the Android sound channels here too (not only on entering Chat) so they
      // exist as soon as permission is granted, regardless of which tab is opened first
      if (isPlatform('android')) {
        try {
          await LocalNotifications.createChannel({
            id: '1',
            name: 'channel1',
            importance: 4,
            visibility: 1,
            vibration: true,
            sound: 'morse_r.wav'
          });
          await LocalNotifications.createChannel({
            id: 'silent',
            name: 'channel_silent',
            importance: 3,
            visibility: 1,
            vibration: false,
            sound: ''
          });
        } catch (e) {
          LogS.log(0, "Failed to create Android notification channels: " + e);
        }
      }
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


  // Lifecycle log and the callbacks of the reconnect cycle. The cycle scans and connects through this page,
  // so it needs it mounted. The page is not expected to unmount while the app runs. If it does, the scan and the
  // callbacks are gone and the log line shows when and in which state it happened.
  useEffect(() => {
    LogS.log(0, "[LIFECYCLE] Connect tab mounted");

    AutoReconnectManager.getInstance().register({
      probeFn: (devID) => probeNode(devID),
      connectFn: (devID) => reconnectConnectFn.current(devID),
    });

    return () => {
      LogS.log(1, "[LIFECYCLE] Connect tab UNMOUNTED, connected: " + BLEconnStore.getRawState().ble_connected
        + ", reconnect: " + ReconnectStore.getRawState().state
        + ", scan running: " + scan_running.current
        + ", connect in progress: " + connInProgress.current);
      AutoReconnectManager.getInstance().unregister();
    };
  }, []);


  // A cycle ended without connection: the user got the alert and knows. The marker for the cold start reconnect is
  // cleared, otherwise every app start would search for the node again. It stays set only while nobody saw the link
  // end (the app was killed), or while the cycle still runs / waits for the app to come back.
  useEffect(() => {
    if (recResult !== null) {
      LogS.log(0, "[RECONNECT] cycle ended without connection (" + recResult + "), no reconnect after a cold start");
      markConnected(false);
    }
  }, [recResult]);


  // Cold start: the app was ended while a connection was up (the DB marker says so, App.tsx sets coldStartPending).
  // One reconnect cycle starts here. It does not scan by itself: the cycle only listens to the scan of this page, which the
  // scan effect below starts and stops as always, so the two never overlap. The flag is consumed first, so a re-render
  // or a second mount cannot start the cycle twice.
  useEffect(() => {
    if (!recColdStart || !isAppActive) return;

    ReconnectStore.update(s => {
      s.coldStartPending = false;
    });
    const rs = ReconnectStore.getRawState();
    if (BLEconnStore.getRawState().ble_connected || connInProgress.current) {
      LogS.log(0, "[RECONNECT] cold start: already connected or connecting, no cycle");
      return;
    }
    LogS.log(0, "[RECONNECT] cold start: starting the cycle for " + rs.lastDeviceId);
    AutoReconnectManager.getInstance().start(rs.lastDeviceId);
  }, [recColdStart, isAppActive]);


  // remember the app did run. The scan itself is driven by the scan effect below
  useIonViewDidEnter(() => {
    if (!didrun.current) {
      didrun.current = true;
    }
  });


  // actions when app goes or comes from background
  useEffect(() => {
    // set REF to current state
    isAppActive_Ref.current = isAppActive;
    // the config sync watchdog has a time limit for the background
    ConfigSyncWatchdog.getInstance().setAppActive(isAppActive);

    // the config finished while we were in the background, so the chat redirect was skipped
    if (isAppActive && confFinInBackground.current) {
      confFinInBackground.current = false;
      if (nodeConfFin > 0 && !setConfAl) {
        LogS.log(0, "Connect - Config finished in background, redirect to chat");
        navigate("/chat");
      }
    }
    //App did run already and is not fresh started
    if (didrun.current) {
      console.log("Connect - App active: " + isAppActive_Ref.current);
      LogS.log(0, "App active: " + isAppActive_Ref.current);

      // if the app goes to background stop the timesync
      if (!isAppActive_Ref.current) {
        TimeSyncManager.getInstance().stopSync();
        LogS.log(0, "Connect - App in background, stop TimeSync");

        // a reconnect cycle does not run in the background (scan and timers are not reliable there).
        // It starts again when the app comes back
        if (AutoReconnectManager.getInstance().isRunning()) {
          LogS.log(0, "[RECONNECT] app in background, cycle stopped, resumes when the app is active");
          AutoReconnectManager.getInstance().stop();
          pendingReconnect.current = true;
        }
      } else {
        // if the app comes back to foreground we start the timesync again
        if (connFlag) {
          LogS.log(0, "Connect - App active and connected, start TimeSync");
          TimeSyncManager.getInstance().startSync(devID_s, TIMESYNC_INTERVAL);
        }

        // the link may have been lost while we were in the background
        resumeReconnect();
      }
    }
  }, [isAppActive]);


  // The app is in the foreground again: start the reconnect cycle if the link was lost in the meantime
  const resumeReconnect = async () => {
    const rs = ReconnectStore.getRawState();
    LogS.log(0, "[LIFECYCLE] app active, connected: " + BLEconnStore.getRawState().ble_connected
      + ", Connect tab mounted, reconnect: " + rs.state + ", enabled: " + rs.enabled
      + ", pending: " + pendingReconnect.current + ", last node: " + rs.lastDeviceId);

    if (!rs.enabled || rs.lastDeviceId === "") {
      pendingReconnect.current = false;
      return;
    }

    // Android can freeze the JS while the app is in the background: the disconnect callback then never arrives
    // and the app still thinks it is connected. Ask the system if the node is really connected.
    if (BLEconnStore.getRawState().ble_connected && pltfrm.current === "android") {
      const devID = ConfigObject.getBleDevId();
      try {
        const connected = await BleClient.getConnectedDevices([RAK_BLE_UART_SERVICE]);
        const alive = connected.some((d) => d.deviceId === devID);
        if (!alive) {
          LogS.log(1, "[RECONNECT] app thinks it is connected, but the link is gone. Running the disconnect handling");
          await onDisconnect(devID);
        }
      } catch (error) {
        LogS.log(1, "[RECONNECT] could not check the connected devices: " + error);
      }
      return;
    }

    if (pendingReconnect.current && !BLEconnStore.getRawState().ble_connected && !connInProgress.current) {
      pendingReconnect.current = false;
      AutoReconnectManager.getInstance().start(rs.lastDeviceId);
    }
  }


  // async timeout function for BLE scan
  const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * BLE Library Doc: https://github.com/capacitor-community/bluetooth-le
   */

  // make sure BLE is initialized and usable on the phone before a scan
  const initBleForScan = async () => {
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
  }

  // a scan result arrives: update the entry of the device
  const handleScanResult = (result: ScanResult) => {
    scan_diag.current.anyResult();

    const id = result.device.deviceId;
    const old = scan_map.current.get(id);

    // the manufacturer data of a MeshCom node carries its name (key 17229 = "MC"). A node whose local name does not fit
    // into the advert is known only by it, so it is evaluated before the check for a name below
    const mfName = meshcomManufacturerName(result.manufacturerData);

    // only devices with a name are of interest
    let devName = result.device.name;
    if (!devName && pltfrm.current === "android") {
      // android fills device.name from a name cache of the stack, which is empty for some adverts (e.g. right after a
      // GATT connection was closed). Without this the node would count as "not heard" although it is received.
      devName = advLocalName(result.rawAdvertisement) ?? old?.res.devName;
    }
    if (!devName && !mfName) return;

    let blename = mfName ?? devName!.toString();
    let nameFromMf = mfName !== null;
    const ble_rssi = result.rssi ?? -127;

    // an advertisement without manufacturer data must not throw away the callsign we already know
    if (old && old.nameFromMf && !nameFromMf) {
      blename = old.res.devName;
      nameFromMf = true;
    }

    // diagnostics: adverts of MeshCom nodes and of the node we reconnect to
    if (nameFromMf || blename.startsWith("MC-") || id === ReconnectStore.getRawState().lastDeviceId) {
      scan_diag.current.nodeResult(id, blename, Date.now(), ble_rssi, !!result.device.name);
    }

    const rssi = old ? old.rssi + (ble_rssi - old.rssi) * RSSI_SMOOTHING : ble_rssi;

    // arrival times of the latest adverts. Only the window of the hit rate is kept
    const now = Date.now();
    const recent = old ? old.recent : [];
    recent.push(now);
    trimAdvertTimes(recent, now);

    scan_map.current.set(id, {
      res: { devName: blename, rssi_: Math.round(rssi).toString(), dev_id_: id },
      rssi: rssi,
      lastSeen: now,
      nameFromMf: nameFromMf,
      recent: recent
    });
  }

  // publish the collected scan results to the list. Devices we did not hear for a while are dropped
  const refreshScanList = () => {
    const now = Date.now();

    scan_map.current.forEach((entry, id) => {
      if (now - entry.lastSeen > SCAN_STALE_MS) scan_map.current.delete(id);
    });

    const all: ScanRes[] = Array.from(scan_map.current.values()).map((e) => ({ ...e.res, rssi_: Math.round(e.rssi).toString() }));
    // sorted by callsign, so OE1KFR-1 and OE1KFR-2 stand together although the node id in front differs
    all.sort((a, b) => compareBleNodes(a.devName, b.devName));
    ble_scan_devices.current = all;

    // filter if we want to see only MC devices
    setScanDevices(showMConly_ref.current ? all.filter((dev) => dev.devName.startsWith("MC-")) : all);
  }

  // queue a start or stop of the scan, so they never overlap
  const enqueueScan = (task: () => Promise<void>) => {
    scan_queue.current = scan_queue.current.then(task).catch(() => { });
    return scan_queue.current;
  }

  // one [SCAN] line per MeshCom node every SCAN_DIAG_MS: tells when and why a node was not in the list
  const logScanDiag = () => {
    const lastId = ReconnectStore.getRawState().lastDeviceId;
    const watch = lastId !== ""
      ? [{ id: lastId, label: scan_map.current.get(lastId)?.res.devName ?? lastId }]
      : [];
    for (const line of scan_diag.current.report(Date.now(), SCAN_STALE_MS, watch)) {
      LogS.log(0, line);
    }
  }

  // start the scan, it runs until stopLiveScan. Results come in continuously
  const startLiveScan = async () => {
    if (scan_running.current) return;

    LogS.log(0, "Scanning BLE Devices");

    try {
      await initBleForScan();

      scan_diag.current.start(Date.now());

      await BleClient.requestLEScan(
        {
          services: [],
          optionalServices: [],
          allowDuplicates: true,  // without it iOS reports every device once and the RSSI would never update
        },
        handleScanResult
      );

      scan_running.current = true;
      ble_scan_ongoing.current = true;
      setIsScanning(true);
      refreshScanList();
      scan_refresh_timer.current = window.setInterval(refreshScanList, SCAN_REFRESH_MS);
      if (scan_diag_timer.current !== null) window.clearInterval(scan_diag_timer.current);
      scan_diag_timer.current = window.setInterval(logScanDiag, SCAN_DIAG_MS);

    } catch (error) {
      LogS.log(1, "Error on BLE Scan! " + error);
      // a reconnect cycle cannot hear the node without a scan
      AutoReconnectManager.getInstance().scanFailed();
      setIsScanning(false);
      setAlHeader("Error on BLE Scan!");
      const err_msg = (error as Error).message;
      if(err_msg.includes("Permission")){
        setAlMsg("Please enable Location Services and Bluetooth!");
        if(pltfrm.current === "android"){
          // check if location services are enabled
          checkLocSettingAndroid();
        }
      } else {
        setAlMsg(err_msg);
      }
      setShAlertCard(true);
    }
  }

  // stop the scan. The list keeps its last state
  const stopLiveScan = async () => {
    if (scan_refresh_timer.current !== null) {
      window.clearInterval(scan_refresh_timer.current);
      scan_refresh_timer.current = null;
    }
    if (scan_diag_timer.current !== null) {
      window.clearInterval(scan_diag_timer.current);
      scan_diag_timer.current = null;
    }
    ble_scan_ongoing.current = false;
    setIsScanning(false);

    if (!scan_running.current) return;
    scan_running.current = false;

    try {
      await BleClient.stopLEScan();
      LogS.log(0, "Stopped Scanning");
    } catch (error) {
      LogS.log(1, "Error on stopping the BLE Scan! " + error);
    }
  }


  // What the live scan knows about a node, for the reconnect cycle: how long ago we heard it and how strong (smoothed)
  const probeNode = (devID: string): ReconnectProbe | null => {
    const entry = scan_map.current.get(devID);
    if (!entry) return null;
    const now = Date.now();
    return {
      seenAgoMs: now - entry.lastSeen,
      rssi: entry.rssi,
      hits: advertHits(entry.recent, now),
    };
  }

  // The scan runs whenever no node is connected or being connected, as long as the Connect tab
  // is shown and the app is in the foreground. It stops for the connect and starts again after
  // a failed connect or a disconnect. While a reconnect cycle searches for the node it also runs on every other
  // tab (the page stays mounted in the background of the tab bar).
  // The decision reads only refs and stores, which are always current,
  // because React can merge fast state changes (e.g. a connect that fails at once) into no change at all.
  const wantScan = () => {
    if (!AppActiveState.getRawState().active
      || BLEconnStore.getRawState().ble_connected
      || connInProgress.current) {
      return false;
    }
    const rec = ReconnectStore.getRawState().state;
    return pageActive_ref.current || rec === 'searching' || rec === 'weak';
  }

  const syncScan = () => enqueueScan(async () => {
    const want = wantScan();
    if (want && !scan_running.current) await startLiveScan();
    if (!want && scan_running.current) await stopLiveScan();
  });

  useEffect(() => {
    syncScan();
  }, [pageActive, isAppActive, connFlag, connecting, recState]);

  // stop the scan when the page goes away
  useEffect(() => {
    return () => {
      LogS.log(1, "[LIFECYCLE] Connect tab unmount cleanup, the scan is stopped");
      enqueueScan(stopLiveScan);
    };
  }, []);


  // open PIN modal for a device
  const openPinModal = async (dev: ScanRes) => {
    pinModalDevice.current = dev;
    await DatabaseService.checkDbConn();
    const existing = await DatabaseService.getBlePin(dev.dev_id_);
    setPinModalCurrentPin(existing ?? "");
    setPinInputVal("");
    setShPinModal(true);
  };

  // save PIN from modal input
  const savePinModal = async () => {
    const dev = pinModalDevice.current;
    if (!dev) return;
    const pin = pinInputVal.trim();
    if (!/^\d{6}$/.test(pin)) {
      setAlHeader("Invalid PIN");
      setAlMsg("PIN must be exactly 6 digits.");
      setShAlertCard(true);
      return;
    }
    if (parseInt(pin, 10) < 100000) {
      setAlHeader("Invalid PIN");
      setAlMsg("PIN must be between 100000 and 999999.");
      setShAlertCard(true);
      return;
    }
    await DatabaseService.checkDbConn();
    await DatabaseService.setBlePin(dev.dev_id_, pin);
    setPinModalCurrentPin(pin);
    setPinInputVal("");
    setShPinModal(false);
    LogS.log(0, "PIN saved for " + dev.devName);
    // if currently connected to this device, also send the command to the node
    if (connFlag && devID_s === dev.dev_id_) {
      sendTxtCmdNode("--btcode " + pin);
      LogS.log(0, "Sent --btcode to connected node: " + dev.devName);
    }
  };

  // clear PIN from modal
  const clearPinModal = async () => {
    const dev = pinModalDevice.current;
    if (!dev) return;
    await DatabaseService.checkDbConn();
    await DatabaseService.clearBlePin(dev.dev_id_);
    setPinModalCurrentPin("");
    setPinInputVal("");
    setShPinModal(false);
    LogS.log(0, "PIN cleared for " + dev.devName);
  };


  
  // handle the filter toggle for MC only devices
  const handleMConly = (state: boolean) => {
    setShowMConly(state);
    showMConly_ref.current = state;
    // filter if we want to see only MC devices
    if(state){
      const mc_filtered = ble_scan_devices.current.filter((dev) => {
        return dev.devName.startsWith("MC-");
      });
      setScanDevices(mc_filtered);
    } else {
      setScanDevices(ble_scan_devices.current);
    }
  }



  // build the hello message for the node. With a BLE PIN set it carries the PIN hash
  const buildHello = async (devID: string): Promise<DataView> => {

    // Look up stored BLE PIN by device ID
    const storedPin = await DatabaseService.getBlePin(devID);
    const pinToUse = (storedPin && storedPin !== "000000") ? storedPin : null;

    if (pinToUse) {
      // Build 36-byte hello: [35, 0x10, 0x20, 0x30, SHA-256(pin)[0..31]]
      const pinStr = pinToUse.padStart(6, '0');
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pinStr));
      const hashBytes = new Uint8Array(hashBuf);
      const buf = new ArrayBuffer(36);
      const v = new DataView(buf);
      v.setUint8(0, 35);   // length marker as firmware expects msg_len >= 35
      v.setUint8(1, 0x10);
      v.setUint8(2, 0x20);
      v.setUint8(3, 0x30);
      hashBytes.forEach((b, i) => v.setUint8(4 + i, b));
      LogS.log(0, "Sending Hello Msg with PIN hash for device: " + devID);
      return v;
    }

    // No PIN — original open hello
    const buf = new ArrayBuffer(4);
    const v = new DataView(buf);
    v.setUint8(0, 4);
    v.setUint8(1, 0x10);
    v.setUint8(2, 0x20);
    v.setUint8(3, 0x30);
    return v;
  }



  // watch the config sync after the hello: request missing config again, fail if it does not come
  const startConfigSyncWatch = (devID: string) => {
    const wd = ConfigSyncWatchdog.getInstance();
    wd.start({
      sendCmd: async (cmd: string) => {
        LogS.log(0, "Config sync - requesting again: " + cmd);
        await sendTxtCmdNode(cmd);
      },
      resendHello: async () => {
        LogS.log(0, "Config sync - nothing received, sending hello again");
        await sendDV(await buildHello(devID), devID);
      },
      onProgress: (p) => {
        if (p.phase === "retry") {
          // the retry dialog replaces the normal loading dialog
          if (syncHideTimer.current) clearTimeout(syncHideTimer.current);
          syncHideTimer.current = null;
          if (syncShownAt.current === null) syncShownAt.current = Date.now();
          setSyncProgress(p);
          setShLoadConf(false);
        } else if (p.phase === "initial") {
          // frames arrive again after the hello was sent once more: keep the open dialog up to date
          if (syncShownAt.current !== null) setSyncProgress(p);
        } else if (p.phase === "done") {
          // the sync ended: after success the dialog shows "done" for the minimum time, otherwise it closes at once
          const shownAt = syncShownAt.current;
          syncShownAt.current = null;
          if (syncHideTimer.current) clearTimeout(syncHideTimer.current);
          syncHideTimer.current = null;
          if (shownAt !== null && p.outcome === "complete") {
            setSyncProgress(p);
            syncHideTimer.current = setTimeout(() => setSyncProgress(null),
              Math.max(SYNC_DIALOG_MIN_MS - (Date.now() - shownAt), 0));
          } else {
            setSyncProgress(null);
          }
        }
      },
      onComplete: () => {
        LogS.log(0, "Config sync - complete");
        BleConfigFinish.update(s => {
          s.BleConfFin = Date.now();
        });
      },
      onFail: (missing: string[]) => {
        LogS.log(1, "Config sync - failed, missing: " + missing.join(", "));
        setShLoadConf(false);
        setAlHeader("Config could not be loaded completely!");
        setAlMsg("Missing from node: " + missing.join(", ") + ". Please connect again.");
        setShAlertCard(true);
        doDisco(devID);
      },
    });
    // started while the app is in the background
    if (!isAppActive_Ref.current) wd.setAppActive(false);
  }

  // user cancels the config sync while missing data is requested again
  const cancelConfigSync = () => {
    LogS.log(0, "Config sync - cancelled by user");
    ConfigSyncWatchdog.getInstance().stop();
    setSyncProgress(null);
    setShLoadConf(false);
    doDisco(ConfigObject.getBleDevId());
  }



  // connect to device
  // auto: the connect of a reconnect cycle. No alerts (the cycle tells the user), shorter timeout.
  // Returns true if the node is connected and the setup is done
  const connDev = async (devID: string, auto: boolean = false): Promise<boolean> => {
    try {
      return await connDevAttempt(devID, auto);
    } finally {
      // the attempt is over, a failed one has to bring the scan back
      syncScan();
    }
  }

  // the reconnect cycle connects through this one. It calls the function of the latest render
  reconnectConnectFn.current = (devID: string) => connDev(devID, true);

  const connDevAttempt = async (devID: string, auto: boolean = false): Promise<boolean> => {

    // check if we are already connecting to a device
    if (connInProgress.current) {
      LogS.log(0, "BLE Connect already in Progress!");
      return false;
    }

    // the alert of a failed connect. A reconnect cycle shows its own message at the end instead
    const showAlert = (header: string, msg: string) => {
      if (auto) {
        LogS.log(1, "[RECONNECT] connect attempt failed: " + header + " " + msg);
        return;
      }
      setAlHeader(header);
      setAlMsg(msg);
      setShAlertCard(true);
    }

    // set when the node is connected and the setup is done
    let setupOk = false;

    // a reconnect connect is cancelled when its cycle is no longer running (cancel button, app to background)
    const reconnectCancelled = () => auto && !AutoReconnectManager.getInstance().isRunning();

    connInProgress.current = true;

    // no scan while we connect, it disturbs the connection setup
    const scanWasRunning = scan_running.current;
    await syncScan();

    // BLE diagnostics: log each phase of the connect attempt with the time since start
    bleConnT0.current = Date.now();
    let phase = "start";
    const bleDiag = (msg: string) => {
      LogS.log(0, "[BLE] " + msg + " (+" + (Date.now() - (bleConnT0.current ?? Date.now())) + " ms)");
    };
    const connectTimeout = auto ? REC_CONNECT_TIMEOUT : BLE_CONNECT_TIMEOUT;
    bleDiag("connect attempt start, platform: " + pltfrm.current + ", devID: " + devID + ", timeout: " + connectTimeout + (auto ? ", reconnect cycle" : ""));

    // android: a connect right after the stop of the scan can fail, give the stack a moment
    if (pltfrm.current === "android" && scanWasRunning) {
      await sleep(ANDROID_POST_SCAN_DELAY);
      bleDiag("pause after the scan stop done (" + ANDROID_POST_SCAN_DELAY + " ms)");
    }

    LogS.log(0, "Connecting DeviceID: " + devID);
    setConnecting(true);
    // set devId state here local
    setDevIDs(devID);
    // set devID in ConfigObject
    ConfigObject.setBleDevId(devID);
    // check if the DB is open. Makes new connection and opens DB if not
    try {
      await DatabaseService.checkDbConn();
    } catch (error) {
      LogS.log(1, "Error on DB Connection! " + error);
      showAlert("Error on DB Connection!", (error as Error).message);
    }

    // check if DB state is initialized
    if(!DataBaseService.isInit){
      LogS.log(0, "BLE Connect - DB is not initialized!");
      // try to init DB again
      try {
        await DatabaseService.initializeDatabase();
      } catch (error) {
        LogS.log(1, "BLE Connect - Error on DB Initialization! " + error);
        showAlert("Error on DB Initialization!", (error as Error).message);
      }
    } else {
      LogS.log(0, "BLE Connect - DB initialized!");
    }

    try {
      // The node is disconnected in handleBtn before connDev is called, so no disconnect here.
      // (connFlag is stale in the closure when switching directly to another node.)

      if(pltfrm.current === "android"){
        // give android time to tear down the previous connection, otherwise the next connect can fail with GATT_ERROR
        if(lastBleDiscoTs.current !== null){
          const sinceDisco = Date.now() - lastBleDiscoTs.current;
          if(sinceDisco < BLE_RECONNECT_DELAY){
            const waitMs = BLE_RECONNECT_DELAY - sinceDisco;
            bleDiag("reconnect delay: last disconnect " + sinceDisco + " ms ago, waiting " + waitMs + " ms");
            await sleep(waitMs);
            bleDiag("reconnect delay done");
          } else {
            bleDiag("no reconnect delay needed, last disconnect " + sinceDisco + " ms ago");
          }
        }

        // make a disconnect before connecting when on android
        await BleClient.initialize();
        // A failing disconnect (e.g. "Disconnection timeout." on a closed GATT object left over from a
        // connect timeout) must not block the connect. The plugin closes the old GATT object itself.
        const tDisco = Date.now();
        try {
          await BleClient.disconnect(devID);
          bleDiag("pre-connect disconnect ok (" + (Date.now() - tDisco) + " ms)");
        } catch (error: any) {
          bleDiag("pre-connect disconnect failed after " + (Date.now() - tDisco) + " ms: " + error?.message + " - continuing with connect");
        }
      }

      //connect to device
      phase = "connect";
      bleDiag("BleClient.connect called");
      try {
        await BleClient.connect(devID, (deviceId) => onDisconnect(deviceId),{timeout:connectTimeout});
      } catch (error: any) {
        // android: status 133 (GATT_ERROR) is the generic "connection setup failed", a second try mostly works.
        // Only the manual connect retries here, a reconnect cycle has its own attempts.
        const gattError133 = String(error?.message ?? "").includes("133");
        if (!(pltfrm.current === "android" && !auto && gattError133)) {
          throw error;
        }
        bleDiag("GATT error 133, one silent retry in " + ANDROID_GATT_RETRY_DELAY + " ms");
        await sleep(ANDROID_GATT_RETRY_DELAY);
        // the disconnect callback of the failed try closed the DB and cleared the connecting state
        await DatabaseService.checkDbConn();
        setConnecting(true);
        bleDiag("BleClient.connect called again");
        await BleClient.connect(devID, (deviceId) => onDisconnect(deviceId),{timeout:connectTimeout});
      }
      bleDiag("link up");

      // the user cancelled the reconnect while the connect was running: the plugin cannot abort a connect, so drop the link again
      if (reconnectCancelled()) {
        bleDiag("reconnect cancelled while connecting, dropping the link");
        try {
          await BleClient.disconnect(devID);
          lastBleDiscoTs.current = Date.now();
        } catch (error) {
          bleDiag("disconnect after cancel failed: " + error);
        }
        setConnecting(false);
        connInProgress.current = false;
        return false;
      }

      //get services of the device
      phase = "getServices";
      const services = await BleClient.getServices(devID);
      bleDiag("services discovered: " + services.length);

      // negotiated MTU as seen by the phone
      try {
        const mtu = await BleClient.getMtu(devID);
        bleDiag("MTU: " + mtu);
      } catch (error) {
        bleDiag("MTU not available: " + error);
      }

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

      phase = "startNotifications";
      await BleClient.startNotifications(
        devID,
        RAK_BLE_UART_SERVICE,
        RAK_BLE_UART_RXCHAR,
        (value) => {
          parseMsg(value).then(async (res) => {
            if (res !== undefined && 'msgTXT' in res) {
              // escape all quotation marks
              LogS.log(0,"Connect - Txt Msg: " + res.msgTXT);
              const isNewMsg = await DatabaseService.writeTxtMsg(res, !canNotify.current);  // we need to send a flag if this is during init load on node connection or normal msg for marking segmentbuttons in chat
              // do the notification if from another callsign - not for a duplicate (e.g. a PN retry copy) that was not stored
              const curr_call = ConfigObject.getConf().CALL;
              if (isNewMsg && res.fromCall !== curr_call && (!res.msgTXT.startsWith("--")) && canNotify.current) {
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

        phase = "hello";
        bleDiag("notifications started");

        // cancelled during the setup: same as above, but the notifications are running by now
        if (reconnectCancelled()) {
          bleDiag("reconnect cancelled during setup, disconnecting");
          doDisco(devID);
          return;
        }
        LogS.log(0, "Connected to Device: " + devID);

        // update devID in BLE Hook
        updateDevID(devID);

        // we are connected: the loss of this connection starts a reconnect cycle (if enabled).
        // Remember the node for it, in the store and in the DB (survives an app restart)
        wasConnected.current = true;
        AutoReconnectManager.getInstance().clearExpectedDisconnect();

        // the node does not advertise while connected: forget what the scan heard before, so a reconnect after a drop
        // has to hear it again (the scan entries live longer than the connect takes)
        scan_map.current.delete(devID);
        const lastDevChanged = ReconnectStore.getRawState().lastDeviceId !== devID;
        ReconnectStore.update(s => {
          s.lastDeviceId = devID;
          s.lastResult = null;
        });
        if (lastDevChanged) {
          await DatabaseService.setAppSetting(APP_SETTING_LAST_DEVICE, devID);
        }
        // a connection is up that the user did not disconnect: if the app is ended in the background, the cold start reconnects
        await markConnected(true);

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

        const hello_view = await buildHello(devID);
        startConfigSyncWatch(devID);
        try{
          await sendDV(hello_view, devID);
          phase = "done";
          bleDiag("hello sent, setup complete");
        } catch (error) {
          bleDiag("sending hello failed: " + error);
          // if the pairing / bonding process is running on android we get here an error if we try to send data
          // but the hello message is then received on the node
          if(pltfrm.current !== "android"){
            LogS.log(1, "Error on sending Hello Msg: " + error);
            ConfigSyncWatchdog.getInstance().stop();
            showAlert("Error on setting up connection! Remove node from BLE Devices and pair newly!", "Err: " + error);
            setConnecting(false);
            setShLoadConf(false);
            // a reconnect cycle starts clean: the half set up link is dropped, the cycle tries again
            if (auto) doDisco(devID);
          }
          return;
        }

        // update BLE connected state in BLE Hook
        updateBLEConnected(true);

        setConnecting(false);

        setupOk = true;

      }).catch((error) => {

        LogS.log(1, "Error on Start Notifications! " + error);
        bleDiag("setup failed in phase '" + phase + "': " + error);
        // connection happened so we need to to disconnect
        doDisco(devID);
        // alert user
        showAlert("Error on Connecting to Node!", "Please reconnect to Node!");
      });

      setConnecting(false);

      connInProgress.current = false;

      return setupOk;

    } catch (error: any) {

      LogS.log(1,"Error on connect: " + error.message);
      bleDiag("connect failed in phase '" + phase + "': " + error.message);

      const errmsg_str:string = error.message;

      setConnecting(false);

      if(errmsg_str.includes("removed pairing")){

        LogS.log(1,"Error Pairing: " + errmsg_str);
        showAlert("Error Pairing! Remove Node from BLE Devices after Erase/Flash", errmsg_str);
        connInProgress.current = false;
        return false;
      }

      if(errmsg_str.includes("timeout")){

        if(config_s.callSign === "XX0XXX-00"){

          LogS.log(1,"Error Connecting: " + errmsg_str);
          showAlert("Error Connection! Remove Node from BLE Devices after Erase/Flash", errmsg_str);
          connInProgress.current = false;
          return false;
        } else {
          LogS.log(1,"Error Connecting: " + errmsg_str);
          showAlert("Error on Connection!", errmsg_str);
          connInProgress.current = false;
          return false;
        }
      }

      // show alert
      showAlert("Error on Connection!", errmsg_str);

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

      connInProgress.current = false;
      return false;
    }
  }



  // BLE disconnect callback
  async function onDisconnect(deviceId: string) {

    LogS.log(0,"Device disconnected callback from DevID: " + deviceId);
    lastBleDiscoTs.current = Date.now();
    LogS.log(0, "[BLE] disconnect callback, devID: " + deviceId + ", connect in progress: " + connInProgress.current
      + (bleConnT0.current !== null ? ", since connect start: " + (Date.now() - bleConnT0.current) + " ms" : ""));

    // stop Timesync Service
    TimeSyncManager.getInstance().stopSync();

    // the config sync is over with the connection
    ConfigSyncWatchdog.getInstance().stop();

    // forget the callsign of this node, so nothing of the next connection is stored under it
    resetNodeCall();
    ConfigObject.resetConf();

    // Auto reconnect: a connection we had fully set up was lost without user action. The cycle is started BEFORE
    // ble_connected flips below, so BleDiscoAlert sees it running and stays quiet while it searches for the node.
    // Failed connects (wasConnected false) and manual disconnects never start one.
    // A disconnect the app asked for (node sent to Deep Sleep or OTA mode) is no loss either: nothing to reconnect, the
    // normal disconnect alert tells it.
    const wasUp = wasConnected.current;
    const disconnectExpected = wasUp && AutoReconnectManager.getInstance().takeExpectedDisconnect();
    if (disconnectExpected) {
      LogS.log(0, "[RECONNECT] the disconnect was expected, no reconnect");
    }
    const connectionLost = wasUp && manual_ble_disco.current === false && !disconnectExpected;
    wasConnected.current = false;
    if (connectionLost) {
      const rec = ReconnectStore.getRawState();
      if (!AppActiveState.getRawState().active) {
        // JS and scan are not reliable in the background: the cycle starts when the app comes back
        if (rec.enabled) {
          LogS.log(0, "[RECONNECT] link lost in the background, cycle starts when the app is active");
          pendingReconnect.current = true;
        }
      } else if (rec.enabled) {
        LogS.log(0, "[RECONNECT] link lost, starting the cycle for " + deviceId);
        AutoReconnectManager.getInstance().start(deviceId);
      } else {
        await markConnected(false);
      }
    } else if (wasUp) {
      // the app saw this disconnect and starts nothing (user or expected disconnect): nothing to reconnect after a cold start
      await markConnected(false);
    }

    const newConnState = false;
    setConnFlag(newConnState);

    // set Flag in BLE Hook
    updateBLEConnected(false);
    // stop the load conf indicator (disco comes always at connect after fresh flash)
    setShLoadConf(false);

    // update BLE connected state in store. manual_disconnect is captured in the SAME update as
    // ble_connected (both derived from manual_ble_disco.current here, not written separately
    // later) so BleDiscoAlert's effect - which only re-runs when ble_connected actually changes -
    // always sees a consistent snapshot, instead of racing against a later, independently-timed
    // reset of manual_disconnect further down in this function.
    BLEconnStore.update(s => {
      s.ble_connected = false;
      s.manual_disconnect = manual_ble_disco.current;
    });

    // reset notification flag
    canNotify.current = false;

    setConnecting(false);

    // BLE disconnect was not manually triggered - Reconnect
    console.log("Manual disco state: " + manual_ble_disco.current);
    if(manual_ble_disco.current === false) {
      LogS.log(0,"BLE client disconnected without Useraction!");
      // BleDiscoAlert (app root) shows the disconnect alert automatically once
      // BLEconnStore.ble_connected flips false without manual_disconnect being set.

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

    // reset node settings S1, so a node without SN1 (older firmware) does not show the values of the previous node
    NodeSettingsStoreS1.update(s => {
      s.nodeSettingsS1 = { ...defaultNodeSettingsS1 };
    });

    // reset node info S1, so the build date of the previous node is not shown
    NodeInfoStoreS1.update(s => {
      s.infoDataS1 = { ...defaultInfoDataS1 };
    });

    // reset manual disco flag (BLEconnStore.manual_disconnect was already captured atomically
    // with ble_connected above; the next onDisconnect() overwrites it fresh, so no reset needed here)
    manual_ble_disco.current = false;
  }








  // disconnect function
  const doDisco = async (devID: string) => {

    ConfigSyncWatchdog.getInstance().stop();
    manual_ble_disco.current = true;
    // the user ends the connection: no reconnect after a cold start. Stored BEFORE the disconnect, because onDisconnect
    // closes the database while the disconnect call is still running and a write after it can get lost
    await markConnected(false);
    // broadcast the manual-disconnect intent so other pages (Chat, Settings) can suppress their own disco alert
    BLEconnStore.update(s => {
      s.manual_disconnect = true;
    });
    console.log("Connect Tab - Manual disco state: " + manual_ble_disco.current);


    try {
      await BleClient.stopNotifications(devID, RAK_BLE_UART_SERVICE, RAK_BLE_UART_RXCHAR);
      await BleClient.disconnect(devID);
      lastBleDiscoTs.current = Date.now();

      const newConnState = false;
      setConnFlag(newConnState);
      // update BLE connected state in BLE Hook
      updateBLEConnected(false);

      // update BLE connected state in store
      BLEconnStore.update(s => {
        s.ble_connected = false;
      });
    } catch (error: any) {
      console.error("Error on Disconnect: " + error.message);

      // disconnect attempt failed - onDisconnect() won't fire to reset these, so reset them here
      // to avoid leaving a stuck manual-disconnect flag that would suppress a later real disconnect alert
      manual_ble_disco.current = false;
      BLEconnStore.update(s => {
        s.manual_disconnect = false;
      });

      // convert the error message to string
      const err_msg = error.message.toString();
      // reboot the node if the callsign is not set. BLE Authentication Error. 
      if (config_s.callSign === "XX0XXX-00" || config_s.callSign === "" || err_msg.includes("Authentication")) {
        // alert the user
        setAlHeader("Please set your Callsign if not set!");
        setAlMsg("Rebooting Node to set BLE authentication!");
        setShAlertCard(true);
        console.log("Rebooting Node!");
        sendTxtCmdNode("--reboot");
      } else {
        setAlHeader("Error on Disconnect!");
        setAlMsg(error.message);
        setShAlertCard(true);
      }
    }
  }




  // BLE Config Fin state
  useEffect(() => {
    if (nodeConfFin > 0) {
      console.log("Connect - Node Config Finished!");
      setShLoadConf(false);

      // set the current position from GPS and send the position to the node if unconfigured
      if (config_s.callSign === "XX0XXX-00" || config_s.callSign === "" || (config_s.lat === 0 && config_s.lon === 0)) {
        LogS.log(0, "Connect - Unconfigured Node or no Location set!");
        // give the node a default location from phone
        LogS.log(0, "Connect - Setting Initial Position from Phone");
        setCurrPosGPS();
        // delay to give the node time to save the position
        setTimeout(() => { }, 2000);
      }

      // start the TimeSync Manager
      LogS.log(0, "Connect - Starting TimeSyncManager with Timestamp: ");
      TimeSyncManager.getInstance().initialize(syncTimestampToDevice);
      TimeSyncManager.getInstance().startSync(devID_s, TIMESYNC_INTERVAL);

      // set the can notify flag to true
      canNotify.current = true;

      // node runs a firmware older than the app expects - the chat page shows the update hint
      const node_fw = ConfigObject.getConf().FWVER;
      if (isFwOlderThan(node_fw)) {
        LogS.log(0, "Connect - Node firmware " + node_fw + " is older than " + MIN_FW_VERSION);
        UpdateFW.update(s => {
          s.updatefw = true;
        });
      }

      // redirect to chat
      if (isAppActive && !setConfAl) {
        navigate("/chat");
      } else if (!isAppActive) {
        // do it when the app comes back
        confFinInBackground.current = true;
      }
    }
  }, [nodeConfFin]);









  // redirect to config page if unset node
  const redirectConfig = () => {
    ShouldConfStore.update(s => {
      s.shouldConf = false;
    });

    if(isAppActive)
      navigate("/settings");
  }




  // redirect to chat when config is set
  useEffect(()=>{
    if (shRedirChat) {
      console.log("Redirecting to Chat");

      if (isAppActive) {
        navigate("/chat");
        RedirectChatStore.update(s => {
          s.redirChat = false;
        });
      }
    }
  }, [shRedirChat]);




  // switch the auto reconnect on or off. The setting is stored in the DB
  const handleAutoReconnect = async (on: boolean) => {
    // the toggle also reports changes that come from the store, nothing to do for those
    if (on === ReconnectStore.getRawState().enabled) return;

    ReconnectStore.update(s => {
      s.enabled = on;
    });
    LogS.log(0, "[RECONNECT] auto reconnect " + (on ? "enabled" : "disabled"));

    if (!on) {
      // a running cycle ends, nothing is waiting for the app to come back
      AutoReconnectManager.getInstance().stop();
      pendingReconnect.current = false;
      // an old marker must not start a cycle after the setting is switched on again later
      await markConnected(false);
    }
    await DatabaseService.setAppSetting(APP_SETTING_AUTO_RECONNECT, on ? '1' : '0');
  }


  // handle connect disconnect on the buttons
  const handleBtn = async (devIDBtn:string) => {
    // the user decides by hand: a running reconnect cycle must not connect on its own at the same time
    AutoReconnectManager.getInstance().stop();
    pendingReconnect.current = false;

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
          <IonToolbar className="mc-toolbar">
            <IonTitle>Devices</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding mc-page">
          <IonHeader collapse="condense">
            <IonToolbar className="mc-toolbar">
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
          />

          <ConfigSyncRetry progress={syncProgress} onCancel={cancelConfigSync} />

          <div className="mc-stack cn-stack">

            <div className="mc-card">
              <div className="mc-card-head mc-split cn-status">
                <div className="mc-title">
                  <span className="mc-icon"><IonIcon icon={bluetoothOutline} /></span>
                  <div>
                    <div className="mc-card-title">Nearby Nodes</div>
                    <div className="cn-state">
                      {connFlag ? "Tap the node to disconnect"
                        : connecting ? "Connecting..."
                        : recState === 'searching' ? <><span className="cn-pulse"></span>Searching for the lost node...</>
                        : recState === 'weak' ? "Signal too weak, move closer to the node"
                        : isScanning ? <><span className="cn-pulse"></span>Scanning, tap to connect</> : "Scan paused"}
                    </div>
                  </div>
                </div>
                {/* the two switches stand under each other on the right of the card */}
                <div className="cn-toggles">
                  <IonToggle onIonChange={() => handleMConly(!showMConly)} checked={showMConly} color="primary" aria-label="MeshCom only">MeshCom only</IonToggle>
                  <IonToggle onIonChange={(e) => handleAutoReconnect(e.detail.checked)} checked={recEnabled} color="primary" aria-label="Auto reconnect">Auto reconnect</IonToggle>
                </div>
              </div>
            </div>

            {/* while connecting or connected only the node in use is shown. A tap on the card connects or disconnects */}
            {scanDevices.filter((dev) => !(connFlag || connecting) || dev.dev_id_ === devID_s).map((dev) => {
              const isTarget = dev.dev_id_ === devID_s && (connFlag || connecting);
              const isConnected = isTarget && connFlag;
              const rssi = parseInt(dev.rssi_);
              // the part of the BLE name in front of the callsign, e.g. "MC-1c24"
              const nodeId = bleNodeCallsign(dev.devName) !== dev.devName
                ? dev.devName.slice(0, dev.devName.length - bleNodeCallsign(dev.devName).length - 1) : "";

              return (
                <div className={"mc-card cn-card cn-tap " + (isConnected ? "is-connected" : "")} key={dev.dev_id_}
                  role="button" tabIndex={0}
                  aria-label={(isConnected ? "Connected, tap to disconnect " : "Disconnected, tap to connect ") + dev.devName}
                  onClick={() => { if (!connecting) handleBtn(dev.dev_id_); }}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !connecting) handleBtn(dev.dev_id_); }}>
                  <div className="cn-row">
                    {/* the icon shows the connection state: green check connected, red cross disconnected, spinner connecting */}
                    <span className={"cn-state-icon " + (isConnected ? "is-on" : isTarget ? "is-busy" : "is-off")}>
                      {isTarget && !connFlag ? <IonSpinner name="crescent" /> : <IonIcon icon={isConnected ? checkmarkCircle : closeCircle} />}
                    </span>

                    {/* node id small on the left, the callsign big and bold behind it in the same line */}
                    <div className="cn-namebox">
                      <div className="cn-line1">
                        {nodeId && <span className="cn-nodeid">{nodeId}</span>}
                        <span className="mc-card-title cn-name">{bleNodeCallsign(dev.devName)}</span>
                      </div>
                    </div>

                    {isTarget ?
                      <div className={"cn-statetext " + (isConnected ? "is-on" : "is-busy")}>{isConnected ? "Connected" : "Connecting"}</div>
                    :
                      <div className="cn-signal">
                        <span className="cn-rssi">{dev.rssi_} dBm</span>
                        <SignalBars rssi={rssi} />
                      </div>
                    }

                    <IonButton className="cn-key" fill="outline" color="medium" aria-label="BLE PIN"
                      onClick={(e) => { e.stopPropagation(); openPinModal(dev); }}>
                      <IonIcon slot="icon-only" icon={keyOutline}></IonIcon>
                    </IonButton>
                  </div>
                </div>
              );
            })}

            {scanDevices.length === 0 && !connFlag && !connecting &&
              <div className="mc-empty">
                <IonIcon icon={radioOutline} />
                <div>{isScanning ? "Searching for nodes..." : "Scan paused"}</div>
                <div className="cn-hint">Make sure the node is switched on and Bluetooth is enabled.</div>
              </div>
            }

          </div>
        </IonContent>

        {/* PIN Management Modal */}
        <IonModal isOpen={shPinModal} onDidDismiss={() => setShPinModal(false)}>
          <IonHeader>
            <IonToolbar className="mc-toolbar">
              <IonTitle>{pinModalDevice.current?.devName}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShPinModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding mc-page">
            <div className="mc-stack"><div className="mc-card">
            {pinModalCurrentPin ? (
              <IonText color="medium"><p>Current PIN: <strong>{pinModalCurrentPin}</strong></p></IonText>
            ) : (
              <IonText color="medium"><p>No PIN set — open connection.</p></IonText>
            )}
            <IonItem>
              <IonInput
                label="New PIN (6 digits)"
                labelPlacement="floating"
                type="text"
                inputmode="numeric"
                maxlength={6}
                value={pinInputVal}
                onIonInput={(e) => setPinInputVal(e.detail.value ?? "")}
              />
            </IonItem>
            <div className="pin-modal-btns">
              <IonButton expand="block" color="primary" onClick={savePinModal}>
                <IonIcon slot="start" icon={checkmarkCircle}></IonIcon>
                Save PIN
              </IonButton>
              <IonButton expand="block" color="danger" fill="outline" onClick={clearPinModal} disabled={!pinModalCurrentPin}>
                <IonIcon slot="start" icon={trashOutline}></IonIcon>
                Clear PIN
              </IonButton>
              {(!connFlag || pinModalDevice.current?.dev_id_ !== devID_s) && (
                <IonText color="warning"><p>Node not connected! Pin change only in Phone DB.</p></IonText>
              )}
            </div>
            </div></div>
          </IonContent>
        </IonModal>

      </IonPage>
    </>
  );
};

export default Tab1;
