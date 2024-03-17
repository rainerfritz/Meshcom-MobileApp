
import { Geolocation } from '@capacitor/geolocation';
import {useBLE} from '../hooks/BleHandler';
import ConfigObject from './ConfigObject';
import GpsDataStore from '../store/GpsData';



export function usePhoneGps() {

  const {sendDV} = useBLE();
  

  // get current position from GPS
  /**
   * {"timestamp":1678863572074,"coords":{"heading":-1,"longitude":16.316705541217758,"latitude":48.23804867177001,"speed":-1,
   * "altitudeAccuracy":16.129304885864258,"accuracy":8.02911993815469,"altitude":244.1603012084961}}
   */

  const getGpsLocation = async (): Promise<{lat:number, lon:number, alt:number, timestamp:number}>  => {

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
  const setCurrPosGPS = async (save_setting_flag:boolean) => {

      const posObjGPS = await getGpsLocation();
      const devID_s = ConfigObject.getBleDevId();
  
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
  
        console.log("Updating Position for map in DB not implemented yet!");
  
        /*let curr_config = config_s;
  
        curr_config.lat = posObjGPS.lat;
        curr_config.lon = posObjGPS.lon;
        curr_config.alt = posObjGPS.alt;
  
        // add config to DB
        //addCONF(curr_config);*/
  
      }
    };

    return {getGpsLocation, setCurrPosGPS};
}




 