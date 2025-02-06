
// import components
import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonPage, IonProgressBar, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillEnter, useIonViewWillLeave } from '@ionic/react';
import { useStoreState } from 'pullstate';
import { getConfigStore, getGpsData, getSensorSettings, getWxData, getDevID, getBLEconnStore, getAppActiveState } from '../store/Selectors';
import ConfigStore from '../store/ConfStore';
import { ConfType, GpsData, WxData, SensorSettings } from '../utils/AppInterfaces';
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

  // app active state
  const app_active_s:boolean = AppActiveState.useState(s => s.active);

  // for BLE usage we ned the device ID and the BLE connected state
  const devID = useStoreState(DevIDStore, getDevID);
  const ble_connected = BLEconnStore.useState(s => s.ble_connected);


  // for updating we need access to BLE
  const {addMsgQueue, updateDevID, updateBLEConnected} = useBLE();

  // update info page with interval when page is active
  const updateInterval = 6000; // ms
  const updateTimerRef = useRef<number>(0);

  // update commands to the phone so we get the jsons etc
  const cmds = ["--info", "--pos", "--wx", "--seset"];
  const cmd_index = useRef<number>(0);
  const window_active = useRef<boolean>(false);


  // things we need to do when we enter the page
  useIonViewDidEnter(() => {
    console.log('Info Tab: View entered');
    window_active.current = true;
    // update the BLE hook
    console.log("Info Tab: BLE Device ID: " + ConfigObject.ble_dev_id);
    updateDevID(ConfigObject.ble_dev_id);
    console.log("Info Tab: BLE Connected: " + ble_connected);
    updateBLEConnected(ble_connected);
    // start the update timer
    console.log('Info Tab: Starting Update Timer View entered');
    // start the timer only if we have a configured node
    if(config_s.callSign !== "" && config_s.callSign !== "XX0XXX-00")
      startUpdtTimer();
    
  });


  // things we need to do when we leave the page
  useIonViewWillLeave(() => {
    console.log('Info Tab: Leaving Info Tab, Clearing Update Timer');
    window.clearInterval(updateTimerRef.current);
    window_active.current = false;
  });


  // clear the timer when app goes to background
  useEffect(() => {
    console.log('Info Tab: App active State changed: ' + app_active_s);
    if (!app_active_s) {
      console.log('Info Tab: Clearing Update Timer App goes to background');
      clearUpdtTimer();
    }
    if (app_active_s) {
      if(window_active.current) {
        console.log('Info Tab: Starting Update Timer App comes to foreground');
        // start the timer only if we have a configured node
        if(config_s.callSign !== "" && config_s.callSign !== "XX0XXX-00")
          startUpdtTimer();
      }
    }
  }, [app_active_s]);


  // if we get disconnected from BLE, clear the update timer
  useEffect(() => {
    console.log('Info Tab: BLE Connected State changed: ' + ble_connected);
    if (!ble_connected) {
      console.log('Info Tab: Clearing Update Timer BLE disconnected');
      clearUpdtTimer();
    }
  }, [ble_connected]);


  // starts the update timer when BLE is connected
  const startUpdtTimer = () => {
    // only start the timer if BLE is connected
    if (!ble_connected) return;
    //console.log('Info Tab: Starting Update Timer');

    // clear timer if it is running
    if (updateTimerRef.current) {
      window.clearInterval(updateTimerRef.current);
    }

    updateTimerRef.current = window.setInterval(() => {
      console.log('Info Tab: updateTimer ');
      // only update if BLE is connected
      if (ble_connected) {
        if(cmd_index.current >= cmds.length) cmd_index.current = 0;
        // add command to queue
        addMsgQueue(cmds[cmd_index.current]);
        // update index
        cmd_index.current = (cmd_index.current + 1) % cmds.length;
      }
      
    }, updateInterval);
    return () => {
      console.log('Info Tab: Clearing Update Timer in cleanup');
      clearUpdtTimer();
      cmd_index.current = 0;
    };
  }


  // clear the update timer
  const clearUpdtTimer = () => {
    //console.log('Info Tab: Clearing Update Timer');
    window.clearInterval(updateTimerRef.current);
    cmd_index.current = 0;
  }

  // handle log window and messages
  const [shLog, setShLog] = useState<boolean>(false);
  const [logMsgs, setLogMsgs] = useState<string []>([]);
  const openLogWindow = () => {
    clearUpdtTimer();
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
    startUpdtTimer();
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
        </IonHeader>
        <IonToolbar>
          <IonTitle size="large">Info</IonTitle>
        </IonToolbar>

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
                <div>Press: {wx_s.PRES.toFixed(2)} hPa</div>
                <div>QNH: {wx_s.QNH.toFixed(2)} hPa</div>
                <div>GasRes: {wx_s.GAS.toFixed(1)} k&Omega;</div>
                <div>eCO2: {wx_s.CO2.toFixed(1)} ppm</div>
                <div>Alt Press: {wx_s.ALT.toFixed(0)} m</div>
              </div>
              <div className='lbox'>
                <div>BME280: {SensorSettings_s.BME ? 'ON' : 'OFF'}</div>
                <div>BMP280: {SensorSettings_s.BMP ? 'ON' : 'OFF'}</div>
                <div>BME680: {SensorSettings_s[680] ? 'ON' : 'OFF'}</div>
                <div>MCU811: {SensorSettings_s[811] ? 'ON' : 'OFF'}</div>
                <div>LPS: {SensorSettings_s.LPS33 ? 'ON' : 'OFF'}</div>
                <div>OneWire: {SensorSettings_s.OW ? 'ON' : 'OFF'}</div>
                <div>OneWire Pin: {SensorSettings_s.OWPIN}</div>
              </div>
            </div>
          </IonCardContent>
        </IonCard>


        <div className="info-box">
          <div>
            <div>Node FW: {config_s.fw_ver}</div>
            <div>App Version: 4.22</div>
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
