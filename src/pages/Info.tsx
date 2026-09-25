
// import components
import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonPage, IonProgressBar, IonTitle, IonToolbar } from '@ionic/react';
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
    const newLogs = LogS.logs;
    setLogMsgs(newLogs);
  }

  const clearLogMsgs = () => {
    LogS.clearLogs();
    setLogMsgs([]);
  }

  const closeLogWindow = () => {
    setShLog(false);
  }




  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Info</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Info</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="info-box">
          <div className='iBox'>
            <div>BAT: {config_s.bat_perc}% <IonProgressBar value={(config_s.bat_perc / 100.)}></IonProgressBar></div>
          </div>
          <div className='iBox'>
            <div>{config_s.bat_volt}V</div>
          </div>
          <div className='iBox'>
            <div>HW: {config_s.hw}</div>
          </div>
        </div>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>GPS</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className='value_cont'>
              <div className='lbox'>
                <div>Lat: {gps_s.LAT.toFixed(4)+"°"}</div>
                <div>Long: {gps_s.LON.toFixed(4)+"°"}</div>
                <div >Alt: {gps_s.ALT}m</div>
                <div>SATs: {gps_s.SAT}</div>
              </div>
              <div className='lbox'>
                <div>Fix: {gps_s.SFIX ? 'YES' : 'NO'}</div>
                <div>HDOP: {gps_s.HDOP}</div>
                <div>Next POS: {gps_s.NEXT}</div>
                <div>UTC Offset: {config_s.node_utc_offset + " h"}</div>
              </div>
            </div>
            <div className='font-size108'>Date: {gps_s.DATE}</div>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Sensors</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className='value_cont'>
              <div className='lbox'>
                <div>Temp: {wx_s.TEMP.toFixed(1)}°</div>
                <div>TOUT: {wx_s.TOUT.toFixed(1)}°</div>
                <div>Humidity: {wx_s.HUM.toFixed(1)} %</div>
                <div>Press: {wx_s.PRES.toFixed(1)} hPa</div>
                <div>QNH: {wx_s.QNH.toFixed(1)} hPa</div>
                <div>GasRes: {wx_s.GAS.toFixed(1)} k&Omega;</div>
                <div>eCO2: {wx_s.CO2.toFixed(0)} ppm</div>
                <div>Alt Press: {wx_s.ALT.toFixed(0)} m</div>
                {sensorSettingsS1_s.INA226 && <>
                  <div>VBUS: {wx_s.VBUS.toFixed(1)} V</div>
                  <div>VSHUNT: {wx_s.VSHUNT.toFixed(1)} V</div>
                  <div>VAMP: {wx_s.VAMP.toFixed(1)} A</div>
                  <div>VPOW: {wx_s.VPOW.toFixed(1)} W</div>
                </>}
              </div>
              <div className='lbox'>
                <div>BME280: {SensorSettings_s.BME ? 'ON' : 'OFF'}</div>
                <div>BMP280: {SensorSettings_s.BMP ? 'ON' : 'OFF'}</div>
                <div>BMP390: {SensorSettings_s.BMP3 ? 'ON' : 'OFF'}</div>
                <div>BME680: {SensorSettings_s[680] ? 'ON' : 'OFF'}</div>
                <div>MCU811: {SensorSettings_s[811] ? 'ON' : 'OFF'}</div>
                <div>LPS: {SensorSettings_s.LPS33 ? 'ON' : 'OFF'}</div>
                <div>OneWire: {SensorSettings_s.OW ? 'ON' : 'OFF'}</div>
                <div>OneWire Pin: {SensorSettings_s.OWPIN}</div>
                <div>AHT-20: {SensorSettings_s.AHT ? 'ON' : 'OFF'}</div>
                { sensorSettingsS1_s.INA226 ? <div>INA226: ON</div> : <div>INA226: OFF</div>}
              </div>
            </div>
          </IonCardContent>
        </IonCard>


        <div className="info-box">
          <div>
            <div>Node FW: {config_s.fw_ver}</div>
            <div>Build: {infoDataS1_s.BDATE}</div>
            <div>App Version: 4.29</div>
          </div>
        </div>

        <div id="LogBtn">
          <IonButton size='small' fill='outline' slot='start' color='primary' onClick={() => openLogWindow()}>Log</IonButton>
        </div>
        <div id="spacer-bottom"></div>
        <IonModal isOpen={shLog}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>LOG</IonTitle>
              <IonButtons slot="start">
                <IonButton onClick={() => clearLogMsgs()}>Clear</IonButton>
              </IonButtons>
              <IonButtons slot="end">
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
        </IonModal>

      </IonContent>
    </IonPage>
  );
};

export default Info;
