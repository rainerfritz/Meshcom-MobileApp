import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCol, IonGrid, IonRow, IonText } from "@ionic/react";

import { PosType } from "../utils/AppInterfaces";
import { useState } from "react";
import DMfrmMapStore from "../store/DMfrmMap";
import { useHistory } from "react-router";
import './MapOverlay.css';


interface MapOverlayProps extends PosType {
    onCloseOverlay: () => void;
  }

  /*
  callSign={markerInfo.call_} lat={markerInfo.lat_} lon={markerInfo.lon_} alt={markerInfo.alt_} bat={markerInfo.bat_}
                  hw={markerInfo.hw_} pressure={markerInfo.press_} humidity={markerInfo.hum_} temperature={markerInfo.temp_} qnh={markerInfo.qnh_} timestamp={markerInfo.timestamp_} 
                  comment={markerInfo.comment_} temp_2={markerInfo.temp_2_} co2={markerInfo.co2_} gas_res={markerInfo.gas_res_} alt_press={markerInfo.alt_press_}
                  onCloseOverlay={onCloseOverlay}
   */

export const MapOverlay: React.FunctionComponent<MapOverlayProps> = ({ callSign, lat, lon, alt, bat, hw, pressure, humidity, temperature, qnh, timestamp, comment, temp_2, co2, gas_res, onCloseOverlay }) => {

    const history = useHistory();

    // state to show more info like pressure, etc
    const [shExtInfo, setShExtInfo] = useState(false);


    // handle DM Button and switch to chat page
    const handleDM = (toCall:string) => {
        DMfrmMapStore.update(s => {
            s.dmfDMfrmMap.shDMfrmMap = true,
            s.dmfDMfrmMap.dmCallMap = toCall
        });
        // close the overlay
        onCloseOverlay();
        // forward to chat page
        history.push("/chat");
    }



    return (
        <>
            <div className="map-overlay-container">
                <IonCard>
                    <IonCardHeader>
                        <IonCardTitle>{callSign}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                        <div className="info-container">
                            <div className="info">
                                <IonText>Latitude: {lat}</IonText><br />
                                <IonText>Longitude: {lon}</IonText><br />
                                <IonText>Altitude: {alt}m</IonText><br />
                                {bat !== "N.A." ? <>
                                    <IonText>Battery: {bat}%</IonText><br />
                                </> : <></>}    
                                <IonText>HW: {hw}</IonText><br />
                            </div>
                            {shExtInfo && (
                                <div className="info">
                                    <IonText>Pressure: {pressure}hPa</IonText><br />
                                    <IonText>Temp: {temperature == 999 ? "n.a." : temperature}°C</IonText><br/>
                                    <IonText>Temp 2: {temp_2 == 999 ? "n.a." : temp_2}°C</IonText><br/>
                                    <IonText>Humidity: {humidity}%</IonText><br/>
                                    <IonText>QNH: {qnh}hPa</IonText><br />
                                    <IonText>eCO2: {co2}ppm</IonText><br />
                                    <IonText>Gas Res.: {gas_res}k&Omega;</IonText><br />
                                </div>
                            )}
                        </div>
                        <div className="button-container">
                            <IonButton size="small" onClick={() => handleDM(callSign)}>DM</IonButton>
                            <IonButton size="small" onClick={() => setShExtInfo(!shExtInfo)}>
                                {shExtInfo ? "Less" : "More"}
                            </IonButton>
                            {shExtInfo && (<IonButton size="small" onClick={onCloseOverlay}>Close</IonButton>)}
                        </div>
                    </IonCardContent>
                </IonCard>
            </div>
        </>
    )
}