
import { Geolocation } from '@capacitor/geolocation';
import {useBLE} from '../hooks/BleHandler';
import ConfigObject from './ConfigObject';
import GpsDataStore from '../store/GpsData';
import LogS from './LogService';



export function usePhoneGps() {

  const {sendDV, sendTxtCmdNode} = useBLE();
  

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
  const setCurrPosGPS = async () => {

      const posObjGPS = await getGpsLocation();
      let cmd_str = "";

      if(posObjGPS.alt !== undefined && posObjGPS.lat !== undefined && posObjGPS.lon !== undefined){

        console.log("Phone GPS Latitude: " + posObjGPS.lat + ", Longitude: " + posObjGPS.lon + ", Altitude: " + posObjGPS.alt);
        cmd_str = "--setlat " + posObjGPS.lat + " --setlon " + posObjGPS.lon + " --setalt " + posObjGPS.alt;

        // send command to node
        sendTxtCmdNode(cmd_str);
        
      } else {
        LogS.log(1, "Phone GPS: Position data is incomplete. Cannot set position on node.");
        return;
      }
  
    };

    return {getGpsLocation, setCurrPosGPS};
}




 