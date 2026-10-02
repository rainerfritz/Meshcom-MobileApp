
// import components
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonPage, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import { locationOutline, thermometerOutline, hardwareChipOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';
import { useStoreState } from 'pullstate';
import { getConfigStore, getGpsData, getSensorSettings, getWxData, getDevID, getBLEconnStore, getAppActiveState } from '../store/Selectors';
import ConfigStore from '../store/ConfStore';
import { ConfType, GpsData, WxData, SensorSettings, SensorSettingsS1, InfoDataS1 } from '../utils/AppInterfaces';
import {useBLE} from '../hooks/BleHandler';
import AppActiveState  from '../store/AppActive';
import { DevIDStore } from '../store';

// import css
import './Info.css';
import GpsDataStore from '../store/GpsData';
import WxDataStore from '../store/WxData';
import { useEffect, useRef, useState } from 'react';
import SensorSettingsStore from '../store/SensorSettings';
import BLEconnStore from '../store/BLEconnected';
import ConfigObject from '../utils/ConfigObject';
import LogS from '../utils/LogService';
import SensorSettingsS1Store from '../store/SensorSettingsS1';
import NodeInfoStoreS1 from '../store/NodeInfoStoreS1';
import { Clipboard } from '@capacitor/clipboard';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';



// create info page
const Info: React.FC = () => {



  //config from sate store
  const config_s:ConfType = useStoreState(ConfigStore, getConfigStore);

  // get GpsData from store
  const gps_s:GpsData = useStoreState(GpsDataStore, getGpsData);

  // get WxData from store
  const wx_s:WxData = useStoreState(WxDataStore, getWxData);

  // Sensor Settings
  const SensorSettings_s:SensorSettings = useStoreState(SensorSettingsStore, getSensorSettings);

  const sensorSettingsS1_s:SensorSettingsS1 = SensorSettingsS1Store.useState(s => s.sensorSettingsS1);

  // node info S1 (build date)
  const infoDataS1_s:InfoDataS1 = NodeInfoStoreS1.useState(s => s.infoDataS1);

  // app active state
  const app_active_s:boolean = AppActiveState.useState(s => s.active);

  // for BLE usage we ned the device ID and the BLE connected state
  const devID = useStoreState(DevIDStore, getDevID);
  const ble_connected = BLEconnStore.useState(s => s.ble_connected);


  // for updating we need access to BLE
  const {sendTxtCmdNode, updateDevID, updateBLEConnected} = useBLE();

  // update info page with interval when page is active
  const updateInterval = 5000; // ms
  const updateTimerRef = useRef<number>(0);

  // update commands to the phone so we get the jsons etc
  const cmds = ["--info", "--pos", "--wx", "--seset"];
  const cmd_index = useRef<number>(0);
  // Whether this tab is the one currently shown. Derived from the router location instead of
  // useIonViewDidEnter/useIonViewWillLeave: those Ionic view lifecycle events never fire in this
  // IonTabs + react-router v6 setup, which is why the update timer used to stay off.
  const location = useLocation();
  const pageActive = location.pathname.replace(/\/+$/, "") === "/info";

  // log window state - the update timer pauses while the log is open
  const [shLog, setShLog] = useState<boolean>(false);
  const [logMsgs, setLogMsgs] = useState<string []>([]);
  const [copyToastMsg, setCopyToastMsg] = useState<string>("");


  // owns the whole update timer lifecycle. Runs with a fresh closure on every relevant change,
  // so it also starts by itself when the node connects while we are already sitting on the page.
  useEffect(() => {
    const callSignOk = config_s.callSign !== "" && config_s.callSign !== "XX0XXX-00";

    if (!pageActive || !app_active_s || !ble_connected || !callSignOk || shLog) {
      console.log('Info Tab: Update Timer off - pageActive:' + pageActive + ' appActive:' + app_active_s
                  + ' bleConnected:' + ble_connected + ' callSignOk:' + callSignOk + ' logOpen:' + shLog);
      clearUpdtTimer();
      return;
    }

    // prime the BLE hook of this component instance with the current values
    console.log("Info Tab: BLE Device ID: " + ConfigObject.getBleDevId());
    updateDevID(ConfigObject.getBleDevId());
    updateBLEConnected(ble_connected);

    console.log('Info Tab: Starting Update Timer');
    startUpdtTimer();

    return () => clearUpdtTimer();
  }, [pageActive, app_active_s, ble_connected, config_s.callSign, shLog]);


  // starts the update timer. The conditions are owned by the effect above.
  const startUpdtTimer = () => {

    // clear timer if it is running
    if (updateTimerRef.current) {
      window.clearInterval(updateTimerRef.current);
    }

    updateTimerRef.current = window.setInterval(() => {
      console.log('Info Tab: updateTimer ');
      if(cmd_index.current >= cmds.length) cmd_index.current = 0;
      // send the command via BLE
      sendTxtCmdNode(cmds[cmd_index.current]);
      // update index
      cmd_index.current = (cmd_index.current + 1) % cmds.length;
    }, updateInterval);
  }


  // clear the update timer
  const clearUpdtTimer = () => {
    //console.log('Info Tab: Clearing Update Timer');
    window.clearInterval(updateTimerRef.current);
    cmd_index.current = 0;
  }

  // handle log window and messages. The update timer pauses/resumes via the shLog dependency
  // of the timer effect above.
  const openLogWindow = () => {
    setShLog(true);
    // copy the array, LogS mutates its own array in place
    setLogMsgs([...LogS.logs]);
  }

  // copy the whole log to the clipboard, oldest entry first, so users can paste it into a mail
  const copyLogMsgs = async () => {
    let appVersion = "unknown";
    try {
      const info = await App.getInfo();
      appVersion = info.version + " (" + info.build + ")";
    } catch (error) {
      // App.getInfo is not available on web
    }
    const header = "MeshCom App " + appVersion + " - " + Capacitor.getPlatform() + " - " + new Date().toLocaleString();
    const logText = header + "\n\n" + [...LogS.logs].reverse().join("\n");

    try {
      await Clipboard.write({ string: logText });
      setCopyToastMsg("Log copied to clipboard");
    } catch (error) {
      setCopyToastMsg("Copy failed");
    }
  }

  const clearLogMsgs = () => {
    LogS.clearLogs();
    setLogMsgs([]);
  }

  const closeLogWindow = () => {
    setShLog(false);
  }




  // battery meter colour
  const batLevel = config_s.bat_perc <= 15 ? 'is-bad' : config_s.bat_perc <= 30 ? 'is-warn' : '';
  const batWidth = Math.max(0, Math.min(100, config_s.bat_perc));

  // one label/value row
  const row = (label:string, value:React.ReactNode, cls:string = '') => (
    <div className="mc-row">
      <div className="mc-label">{label}</div>
      <div className={"mc-value " + cls}>{value}</div>
    </div>
  );

  // sensor ON/OFF chip
  const chip = (label:string, on:boolean) => (
    <span className={"mc-chip " + (on ? "is-on" : "")} key={label}>{label}</span>
  );


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="mc-toolbar">
          <IonTitle>Info</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding mc-page">
        <IonHeader collapse="condense">
          <IonToolbar className="mc-toolbar">
            <IonTitle size="large">Info</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="mc-stack">

          <div className="mc-card mc-hero">
            <div className="mc-hero-top">
              <div>
                <div className="mc-hero-main">{config_s.bat_perc}<small>%</small></div>
                <div className="mc-hero-sub">Battery</div>
              </div>
              <div className="mc-stats">
                <div className="mc-stat">
                  <div className="mc-stat-value">{config_s.bat_volt}V</div>
                  <div className="mc-stat-label">Voltage</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-value">{config_s.hw}</div>
                  <div className="mc-stat-label">Hardware</div>
                </div>
              </div>
            </div>
            <div className={"mc-meter " + batLevel}><span style={{ width: batWidth + "%" }}></span></div>
          </div>

          <div className="mc-card">
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={locationOutline} /></div>
              <div className="mc-card-title">GPS</div>
              <div className="mc-card-actions">
                <span className={"mc-badge " + (gps_s.SFIX ? "is-good" : "is-warn")}>{gps_s.SFIX ? 'Fix' : 'No Fix'}</span>
              </div>
            </div>
            <div className="mc-rows">
              {row("Latitude", gps_s.LAT.toFixed(4) + "°")}
              {row("Longitude", gps_s.LON.toFixed(4) + "°")}
              {row("Altitude", gps_s.ALT + " m")}
              {row("Satellites", gps_s.SAT)}
              {row("HDOP", gps_s.HDOP)}
              {row("Next POS", gps_s.NEXT)}
              {row("UTC Offset", config_s.node_utc_offset + " h")}
              {row("Date", gps_s.DATE)}
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={thermometerOutline} /></div>
              <div className="mc-card-title">Sensors</div>
            </div>
            <div className="mc-rows">
              {row("Temp", wx_s.TEMP.toFixed(1) + " °")}
              {row("TOUT", wx_s.TOUT.toFixed(1) + " °")}
              {row("Humidity", wx_s.HUM.toFixed(1) + " %")}
              {row("Press", wx_s.PRES.toFixed(1) + " hPa")}
              {row("QNH", wx_s.QNH.toFixed(1) + " hPa")}
              {row("GasRes", wx_s.GAS.toFixed(1) + " kΩ")}
              {row("eCO2", wx_s.CO2.toFixed(0) + " ppm")}
              {row("Alt Press", wx_s.ALT.toFixed(0) + " m")}
              {sensorSettingsS1_s.INA226 && <>
                {row("VBUS", wx_s.VBUS.toFixed(1) + " V")}
                {row("VSHUNT", wx_s.VSHUNT.toFixed(1) + " V")}
                {row("VAMP", wx_s.VAMP.toFixed(1) + " A")}
                {row("VPOW", wx_s.VPOW.toFixed(1) + " W")}
              </>}
            </div>
            <div className="mc-section-title">Enabled sensors</div>
            <div className="mc-chips">
              {chip("BME280", SensorSettings_s.BME)}
              {chip("BMP280", SensorSettings_s.BMP)}
              {chip("BMP390", SensorSettings_s.BMP3)}
              {chip("BME680", SensorSettings_s[680])}
              {chip("MCU811", SensorSettings_s[811])}
              {chip("LPS", SensorSettings_s.LPS33)}
              {chip("OneWire", SensorSettings_s.OW)}
              {chip("AHT-20", SensorSettings_s.AHT)}
              {chip("INA226", sensorSettingsS1_s.INA226)}
            </div>
            <div className="mc-rows mc-rows-after">
              {row("OneWire Pin", SensorSettings_s.OWPIN)}
            </div>
          </div>

          <div className="mc-card">
            <div className="mc-card-head">
              <div className="mc-icon"><IonIcon icon={hardwareChipOutline} /></div>
              <div className="mc-card-title">Firmware</div>
            </div>
            <div className="mc-rows">
              {row("Node FW", config_s.fw_ver)}
              {row("FW Build", infoDataS1_s.BDATE)}
              {row("App Version", "4.29")}
            </div>
          </div>

          <div id="LogBtn">
            <IonButton className="mc-pill" size='small' fill='outline' slot='start' color='primary' onClick={() => openLogWindow()}>Log</IonButton>
          </div>

        </div>
        <IonModal isOpen={shLog}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>LOG</IonTitle>
              <IonButtons slot="start">
                <IonButton onClick={() => clearLogMsgs()}>Clear</IonButton>
              </IonButtons>
              <IonButtons slot="end">
                <IonButton onClick={() => copyLogMsgs()}>Copy</IonButton>
                <IonButton onClick={() => closeLogWindow()}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonList>
              {logMsgs.map((log, i) => (
                <IonItem key={i}>
                  <IonLabel>{log}</IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonContent>
          <IonToast
            isOpen={copyToastMsg !== ""}
            message={copyToastMsg}
            duration={2000}
            onDidDismiss={() => setCopyToastMsg("")}
          />
        </IonModal>

      </IonContent>
    </IonPage>
  );
};

export default Info;
