import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonText } from "@ionic/react";

import { PosType } from "../utils/AppInterfaces";
import { useState } from "react";


export const MapOverlay: React.FunctionComponent<PosType> = ({ callSign, lat, lon, alt, bat, hw, pressure, temperature, humidity, qnh }) => {



    return(
    <>
        <IonCard>
            <IonCardHeader>
                <IonCardTitle>{callSign}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
                <IonText>Latitude: {lat}</IonText><br/>
                <IonText>Longitude: {lon}</IonText><br/>
                <IonText>Altitude: {alt}m</IonText><br/>
                {bat !== "N.A." ? <>
                    <IonText>Battery: {bat}%</IonText><br/>
                </>:<></>}
                <IonText>HW: {hw}</IonText><br/>

            </IonCardContent>
        </IonCard>
    </>
    )
}