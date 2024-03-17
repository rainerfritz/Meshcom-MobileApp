import { IonButton, IonContent, IonSearchbar, IonFab, IonFabButton, IonFabList, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillEnter, IonList, IonItem, IonInfiniteScroll, IonInfiniteScrollContent, IonText, useIonViewWillLeave } from '@ionic/react';

import './Map.css';
import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Overlay, ZoomControl, GeoJson, GeoJsonFeature } from "pigeon-maps";
import { osm } from 'pigeon-maps/providers';
import { useStoreState } from 'pullstate';
import PosiStore from '../store/PosiStore';
import { getConfigStore, getPosiStore, getMheards, getDevID } from '../store/Selectors';
import ConfigStore from '../store/ConfStore';
import { ConfType, PosType, MheardType } from '../utils/AppInterfaces';
import { MapOverlay } from '../components/MapOverlay';
import {compass, chevronUpCircle, search, swapHorizontal, contract} from 'ionicons/icons';
import MhStore from '../store/MheardStore';
import AppActiveState from '../store/AppActive';
import DevIDStore from '../store/DevIDstore';
import BLEconnStore from '../store/BLEconnected';
import {useBLE} from '../hooks/BleHandler';
import DatabaseService from '../DBservices/DataBaseService';
import ConfigObject from '../utils/ConfigObject';



const NodeMap = () => {

  const [defaultCenter, setdefaultCenter] = useState<[number, number]>([48.20579, 16.37160]);

  const [center, setCenter] = useState<[number, number]>([48.20579, 16.37160]);

  const [defZoom, setDefZoom] = useState(8);

  const [zoom, setZoom] = useState(8);

  const firstrun = useRef<boolean>(true);

  // current config
  const currConfig:ConfType = ConfigStore.useState(c => c.config);

  // store coordinates of all nodes received
  const positions = PosiStore.useState(s => s.posArr);

  // show markers
  const [showMarkers, setShowMarkers] = useState<boolean>(false);
  // markercolors
  const markerColor = "#3578e5";
  const markerColor_mh = "green";
  const markerColor_own = "purple";


  const [ showCurrentPointInfo, setShowCurrentPointInfo ] = useState(false);

  const [ currentPoint, setCurrentPoint ] = useState({ latitude: 48.20579, longitude: 16.37160 });

  const [ markerInfo, setMarkerInfo] = useState({ lat_: 48.20579, lon_: 16.37160, alt_:243, call_:"OE1KFR-4", bat_:"100", hw_:"RAK4631", press_:0, hum_:0, temp_:0, qnh_:0, timestamp_:0, comment_:"", temp_2_:0, co2_:0, gas_res_:0, alt_press_:0 });

  const viewEntered = useRef<boolean>(false);

  // show searchbar
  const [shSrchBar, setShSrchBar] = useState<boolean>(false);
  // list of positions searching for
  let [results, setResults] = useState<PosType[]>([...positions]);
  // remeber last state of show markerinfo
  const sh_point_search = useRef<boolean>(true);

  // mheards to set color of points
  const mheard_calls = useRef<string []>([]);
  const mharr_s = MhStore.useState(m => m.mhArr);
  const curr_nodecall = useRef<string>("");

  // svg lines from own node to heard nodes
  const [shLines, setShLines] = useState<boolean>(false);
  const line_datas = useRef<any []>([]);

  // app active state
  const app_active_s:boolean = AppActiveState.useState(s => s.active);

  // for BLE usage we need the device ID and the BLE connected state
  const devID = useStoreState(DevIDStore, getDevID);
  const ble_connected = BLEconnStore.useState(s => s.ble_connected);
  const setCenterNewConn = useRef<boolean>(false);

  // when we are not in tracking mode and the app is active in this window, we want to update own position in map
  // update info page with interval when page is active
  const updateInterval = 10000; // ms
  const updateTimerRef = useRef<number>(0);
  const window_active = useRef<boolean>(false);
  const track_active = useRef<boolean>(false);  // Tracking Mode of the Node
  const track_map = useRef<boolean>(false);  // Tracking Mode of the Map
  const [track_map_btn, setTrackMapBtn] = useState<boolean>(false);

  // for updating we need access to BLE
  const {updateDevID, updateBLEConnected, sendTxtCmdNode} = useBLE();




  // prevent default zoom and center when map enters. we want to center on node position
  // insert the full list of positions into the search array, user should see the full list first
  useIonViewDidEnter (()=>{
    console.log("Map window did enter");

    // update the BLE hook
    console.log("Map Tab: BLE Device ID: " + devID);
    updateDevID(ConfigObject.getBleDevId());
    console.log("Map Tab: BLE Connected: " + ble_connected);
    updateBLEConnected(ble_connected);
    window_active.current = true;

    // set default center to own node position
    if(firstrun.current){
      setCenter([currConfig.lat, currConfig.lon]);
      setZoom(14);
      firstrun.current = false;
      if(!track_active.current && ble_connected && app_active_s && currConfig.gps_on === true){
        console.log("Map Tab: Setting Track Map on");
        track_map.current = true;
        setTrackMapBtn(true);
      }
    }

    setTimeout(() => {
      console.log('Map Enter Timer');
      viewEntered.current = true;
    }, 1000);
    
    // start the update timer
    console.log("Map Tab - Track Map: " + track_map.current);
    console.log("Map Tab - BLE Connected: " + ble_connected);
    console.log("Map Tab - App Active: " + app_active_s);
    console.log("Map Tab - GPS Active: " + currConfig.gps_on);
    console.log("Map Tab - Track Active: " + track_active.current);
    if(track_map.current && ble_connected && app_active_s && currConfig.gps_on === true && !track_active.current) {
      // initial pos update to set the pointer
      sendTxtCmdNode("--pos");
      console.log('Map Tab: Starting Update Timer View entered');
      startUpdtTimer();
    }
  });



  // when windiw is not active, set the window_active flag to false
  useIonViewWillLeave (()=>{
    console.log("Map window will leave");
    window.clearInterval(updateTimerRef.current);
    window_active.current = false;
    viewEntered.current = false;
  });

  // TIMER STUFF FOR UPDATING OWN POSITION IN MAP WHEN TRACKING IS OFF
  // clear the timer when app goes to background
  useEffect(() => {
    console.log('Map Tab: App active State changed: ' + app_active_s);
    if (!app_active_s) {
      console.log('Map Tab: Clearing Update Timer App goes to background');
      clearUpdtTimer();
    }
    if (app_active_s ) {
      if(window_active.current && !track_active.current && ble_connected && currConfig.gps_on === true && track_map.current) {
        console.log('Map Tab: Starting Update Timer App comes to foreground');
        startUpdtTimer();
      }
    }
  }, [app_active_s]);


  // if we get disconnected from BLE, clear the update timer
  useEffect(() => {
    console.log('Map Tab: BLE Connected State changed: ' + ble_connected);
    if (!ble_connected) {
      console.log('Map Tab: Clearing Update Timer BLE disconnected');
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
      console.log('Map Tab: updateTimer ');
      // only update if BLE is connected
      if (ble_connected) {
        // add command to queue
        sendTxtCmdNode("--pos");
      }
    }, updateInterval);
    return () => {
      console.log('Map Tab: Clearing Update Timer in cleanup');
      clearUpdtTimer();
    };
  }


  // clear the update timer
  const clearUpdtTimer = () => {
    //console.log('Info Tab: Clearing Update Timer');
    window.clearInterval(updateTimerRef.current);
  }

  // handle the tracking mode of the map track fab button
  const handleTrackMap = () => {
    console.log("Map Tab - Track Map: " + track_map.current);
    track_map.current = !track_map.current;
    if (track_map.current && ble_connected && app_active_s && currConfig.gps_on === true) {
      console.log('Map Tab: Starting Update Timer Track Map');
      setTrackMapBtn(true);
      sendTxtCmdNode("--pos");
      startUpdtTimer();
    } else {
      setTrackMapBtn(false);
      clearUpdtTimer();
    }
  }

  // set map center and zoom to position of connected node
  const setCenterconnNode = () => {

    if(currConfig.lat !== 0.0 && currConfig.lon !== 0.0){
      console.log("Setting new Center on Map");
      //defaultCenter = [nodeCurrPos.lat, nodeCurrPos.lon];
      console.log("New Lat: " + currConfig.lat + " New Lon: " + currConfig.lon);
      const newZoom = zoom;
      const newCenter:[number,number] = [currConfig.lat, currConfig.lon];
      setZoom(newZoom);
      setCenter(newCenter);
      setShowCurrentPointInfo(false);
      setShSrchBar(false);
    }
  }

  // sets parameters when config changes and sets center accordingly
  useEffect(() => {

    if(currConfig){

      console.log("MAP: Config changed");
      console.log("Map Tab: Config Call: " + currConfig.callSign);
      console.log("Map Tab: Config Track: " + currConfig.track_on);
      console.log("Map Tab: Config GPS: " + currConfig.gps_on);

      //update own callsign and delete mheards
      if(currConfig.callSign !== curr_nodecall.current) {
        curr_nodecall.current = currConfig.callSign;
        // update center map when new connection happened in useffect lat lon
        setCenterNewConn.current = true;
        // set initial mheard callsigns for pin colors
        mheard_calls.current = [];
        line_datas.current = [];
        mheard_calls.current = getMHcalls();
      }

      console.log("Map Tab: Track Map Config: " + currConfig.track_on);
      if(currConfig.track_on === true){
        track_active.current = true;
      } else {
        track_active.current = false;
      }

      if(currConfig.gps_on === true && !track_active.current && ble_connected && app_active_s) {
        console.log("Map Tab: Setting Track Map on")
        track_map.current = true;
        setTrackMapBtn(true);
      }

      if(currConfig.gps_on === false && track_map.current){
        console.log("Map Tab: Setting Track Map off")
        track_map.current = false;
        setTrackMapBtn(false);
      }

      console.log("Map Tab: Track Active current: " + track_active.current);

    }
  }, [currConfig.callSign, currConfig.track_on, currConfig.gps_on]);



  // trigger if config lat or lon changes
  useEffect(() => {
    console.log("Map Tab - Config Lat Lon changed")
    if(currConfig){
      console.log("Map Tab: Config Lat: " + currConfig.lat + " Lon: " + currConfig.lon);
      // update center map when new connection happened
      if(setCenterNewConn.current && currConfig.callSign !== "XX"){
        console.log("Map Tab: Setting Center on Map after new connection");
        setCenterconnNode();
        setCenterNewConn.current = false;
      }
      if(!track_active.current && track_map.current && ble_connected && app_active_s && currConfig.gps_on === true){
        console.log("Map Tab: Setting Center on Map");
        setCenterconnNode();
      }
    }
  }, [currConfig.lat, currConfig.lon]);



  // add nodes as markers to map
  useEffect(() => {
    if(positions){
      console.log(positions.length + " Node pos in state map");
      if(positions.length > 0){
        const shMrkrs = true;
        setShowMarkers(shMrkrs);
        //for(let pos of positions) 
          //console.log("Pos in DB Call: " + pos.callSign + " Lat: " + pos.lat + " Lon: " + pos.lon + " Alt: " + pos.alt + " Bat: " + pos.bat);
      }
    }
  }, [positions]);


  // show overlay of marker
  const handleShowMarkerInfo = (e:any, i:any, call:string, lat:number, lon:number, alt:number, bat:string, hw:string, 
    pressure:number, humidity:number, temperature:number, qnh:number, timestamp:number, comment:string, temp_2:number, co2:number, 
    gas_res:number, alt_press:number) => {

    const info = {call_:call, lat_:lat, lon_:lon, alt_:alt, bat_:bat, hw_:hw, press_:pressure, hum_:humidity, temp_:temperature, qnh_:qnh, 
      timestamp_:timestamp, comment_:comment, temp_2_:temp_2, co2_:co2, gas_res_:gas_res, alt_press_:alt_press};
    setMarkerInfo(info);

    setCurrentPoint({latitude:lat, longitude:lon});

    // logic to keep show pointer info if jumped there via searchbar
    if(sh_point_search.current){
      setShowCurrentPointInfo(true);
      sh_point_search.current = false;
    } else {
      setShowCurrentPointInfo(!showCurrentPointInfo);
    }

  }


  // map bounds changes
  const handleBoundsChange = ({ center, zoom, bounds, initial }: any) => {
    if(viewEntered.current === true){
      if (initial) {
        console.log('Got initial bounds: ', bounds)
      }
      if(zoom){
        console.log("Bounds Zoom: " + zoom);
        const newZoom = zoom;
        setZoom(newZoom);
    
      }
      if(center){
        console.log("Bounds Center: " + center);
        const newCenter = center;
        setCenter(newCenter);
      }
    }
  }

  // handle the center fab button. starts also map tracking - polling of own position from node
  const handleCenterBtn = () => {
    setCenterconnNode();
  }

  // searching callsigns
  // add initial all callsigns into results list
  useEffect(()=>{

      console.log("Loading Positions for Searchbar");
      setResults([...positions]);

  },[shSrchBar]);


  // handle searchbar input
  const handleInput = (ev:Event) =>{

    let query = '';
    const target = ev.target as HTMLIonSearchbarElement;
    if (target) query = target.value!.toUpperCase();

    const filtered = positions.filter(pos => {
      return pos.callSign.startsWith(query);
    });

    filtered.sort((a, b) => a.callSign.localeCompare(b.callSign));

    setResults(filtered);
    console.log("Callsigns found: " + filtered.length);
  }


  // handle click on search item
  const goToCallsign = (sPos:PosType) =>{
    setShSrchBar(false);
    const goToPos:[number, number] = [sPos.lat, sPos.lon];
    setZoom(13);
    setCenter(goToPos);
    sh_point_search.current = true;
    handleShowMarkerInfo(1,2,sPos.callSign, sPos.lat,sPos.lon,sPos.alt,sPos.bat,sPos.hw,sPos.pressure,sPos.humidity,
      sPos.temperature,sPos.qnh,sPos.timestamp, sPos.comment, sPos.temp_2, sPos.co2, sPos.gas_res, sPos.alt_press);
    
  }


  // get actual mheard callsigns to switch color for markers and linedata
  useEffect(()=>{
    
    console.log("Mheard Map updating");

    mheard_calls.current = [];
    line_datas.current = [];
    mheard_calls.current = getMHcalls();

  },[mharr_s]);


  // map the callsigns of the mheards into an array - needed for comparison
  const getMHcalls = ():string[] =>{

    let mh_call_arr:string[] = [];

    for(let mhs of mharr_s){
      if(mhs.mh_nodecall === currConfig.callSign){

        if(!mh_call_arr.includes(mhs.mh_callSign)){
          mh_call_arr.push(mhs.mh_callSign);
          console.log("MH MAP Node Call: " + mhs.mh_nodecall + " -> " + mhs.mh_callSign);
        }

        // get lat lon from callsign to have data for svg lines
        let lat_ = 0;
        let lon_ = 0;

        positions.forEach(posi => {
          if(posi.callSign === mhs.mh_callSign){
            lat_ = posi.lat;
            lon_ = posi.lon;
          }
        });

        if(lat_ !== 0 && lon_ !== 0){

          // generate GeoJson Data based on Mheards for linedrawing
          const linedata:any = {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[currConfig.lon, currConfig.lat], [lon_, lat_]] },
            properties: { prop0: "value0" },
          }

          line_datas.current.push(linedata);
        }
      }
    }
    return mh_call_arr;
  }


  // assemble line-data from GeoJson
  const genGeoJsonLineData = ():any => {

    const geoJsonSample = {
      type: "FeatureCollection",
      features: line_datas.current    
    };

    return geoJsonSample;
  }
  

  // set marker color
  const setMarkerColor = (pos_call:string):string => {

    let color = "";

    if(currConfig.callSign === pos_call) color = markerColor_own;
    else if (mheard_calls.current.includes(pos_call)) color = markerColor_mh;
    else color = markerColor;

    return color;
  }


  return (

    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Node Map</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <>
          {shSrchBar ? <>
            <div className='searchbar'>
              <IonSearchbar placeholder='Search Callsign' onIonInput={(ev) => handleInput(ev)} inputMode='search' />
            </div>
            <div className='callsign_list'>
              <IonList>
                {results.length === 0 ? <>
                  <IonItem><IonText>No Search Results</IonText></IonItem>
                </>:<>
                {results.map((result) => (
                  <IonItem onClick={() => goToCallsign(result)}>{result.callSign}</IonItem>
                ))}
                </>}
                
              </IonList>
            </div>
          </> : <></>}

          <Map
            provider={osm}
            mouseEvents={false}
            touchEvents={true}
            defaultCenter={defaultCenter}
            defaultZoom={defZoom}
            center={center}
            zoom={zoom}
            zoomSnap={false}
            minZoom={1}
            maxZoom={18}
            onBoundsChanged={handleBoundsChange}
          >
            {showMarkers ? positions.map((pos, i) => (
              <Marker
                key={i}
                onClick={e => handleShowMarkerInfo(e, i, pos.callSign, pos.lat, pos.lon, pos.alt, pos.bat, pos.hw, pos.pressure, pos.humidity, 
                  pos.temperature, pos.qnh, pos.timestamp, pos.comment, pos.temp_2, pos.co2, pos.gas_res, pos.alt_press)}
                width={50}
                anchor={[pos.lat, pos.lon]}
                color={setMarkerColor(pos.callSign)} />
            )) : <></>}

            {showCurrentPointInfo &&
              <Overlay anchor={[currentPoint.latitude, currentPoint.longitude]} offset={[110, 283]}>
                <MapOverlay callSign={markerInfo.call_} lat={markerInfo.lat_} lon={markerInfo.lon_} alt={markerInfo.alt_} bat={markerInfo.bat_}
                  hw={markerInfo.hw_} pressure={markerInfo.press_} humidity={markerInfo.hum_} temperature={markerInfo.temp_} qnh={markerInfo.qnh_} timestamp={markerInfo.timestamp_} 
                  comment={markerInfo.comment_} temp_2={markerInfo.temp_2_} co2={markerInfo.co2_} gas_res={markerInfo.gas_res_} alt_press={markerInfo.alt_press_}/>
              </Overlay>
            }
            

            {shLines ?   
              <GeoJson
              data={genGeoJsonLineData()}
              styleCallback={(feature:any) => {
                if (feature.geometry.type === "LineString") {
                  return { strokeWidth: "2", stroke: "red" };
                }

              }}
            /> : <></>}

            <ZoomControl buttonStyle={{ background: '#3578e5', color: 'white', width: 40, height: 40, marginBottom: 5 }} style={{ right: 10, top: 10, zIndex: 100 }} />
            <div className='top_right'>Map Tracking {track_map_btn ? "ON":"OFF"}</div>
          </Map>
        </>

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton>
            <IonIcon icon={chevronUpCircle} className='ion-icon-fab'></IonIcon>
          </IonFabButton>
          <IonFabList side="top">
          <IonFabButton className='ion-btn-fab'>
              <IonIcon icon={contract} className='ion-icon-fab' color='primary' onClick={() => handleTrackMap()}></IonIcon>
            </IonFabButton>
            <IonFabButton className='ion-btn-fab'>
              <IonIcon icon={compass} className='ion-icon-fab' color='primary' onClick={() => handleCenterBtn()}></IonIcon>
            </IonFabButton>
            <IonFabButton className='ion-btn-fab'>
              <IonIcon icon={search} className='ion-icon-fab' color='primary' onClick={() => setShSrchBar(!shSrchBar)}></IonIcon>
            </IonFabButton>
            <IonFabButton className='ion-btn-fab'>
              <IonIcon icon={swapHorizontal} className='ion-icon-fab' color='primary' onClick={() => setShLines(!shLines)}></IonIcon>
            </IonFabButton>
          </IonFabList>
        </IonFab>

      </IonContent>
    </IonPage>
  )


};

export default NodeMap