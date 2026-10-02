import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { radioOutline, cellularOutline } from 'ionicons/icons';
import MhStore from '../store/MheardStore';
import ConfigStore from '../store/ConfStore';
import { getMheards, getConfigStore } from '../store/Selectors';
import {ConfType, MheardType} from '../utils/AppInterfaces';
import './Mheard.css';
import { useEffect } from 'react';
import { useStoreState } from 'pullstate';


// LoRa signal quality, used to colour the RSSI/SNR values. RSSI in dBm, SNR in dB.
type Quality = 'good' | 'warn' | 'bad';
const rssiQuality = (rssi:number):Quality => rssi >= -90 ? 'good' : rssi >= -110 ? 'warn' : 'bad';
const snrQuality = (snr:number):Quality => snr >= 0 ? 'good' : snr >= -10 ? 'warn' : 'bad';


const Mheard = () => {

    // msgs from store
    const mharr_s:MheardType[] = useStoreState(MhStore, getMheards);
    // config state to know on which node we are
    const currConfig:ConfType = useStoreState(ConfigStore, getConfigStore);


    useEffect(()=>{
        console.log("MH - " + mharr_s.length + " Mheards in View");
    }, [mharr_s]);

    // only the nodes heard by the node we are connected to
    const ownMheards = mharr_s.filter(mhs => mhs.mh_nodecall === currConfig.callSign);


    return (
        <>
            <IonPage>
                <IonHeader>
                    <IonToolbar className="mc-toolbar">
                        <IonTitle>Heard Nodes</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding mc-page">
                    <IonHeader collapse="condense">
                        <IonToolbar className="mc-toolbar">
                            <IonTitle size="large">Heard Nodes</IonTitle>
                        </IonToolbar>
                    </IonHeader>
                    <div className="mc-stack">
                        {ownMheards.length > 0 ? ownMheards.map((mhs, i) => (
                            <div className="mc-card" key={mhs.mh_callSign + "_" + i}>
                                <div className="mc-card-head">
                                    <div className="mc-icon"><IonIcon icon={radioOutline} /></div>
                                    <div>
                                        <div className="mc-card-title mh-call">{mhs.mh_callSign}</div>
                                        <div className="mh-when">{mhs.mh_date} · {mhs.mh_time}</div>
                                    </div>
                                </div>

                                <div className="mh-stats">
                                    <div className="mh-stat">
                                        <div className={"mh-stat-value is-" + rssiQuality(mhs.mh_rssi)}>{mhs.mh_rssi}<small>dBm</small></div>
                                        <div className="mc-stat-label">RSSI</div>
                                    </div>
                                    <div className="mh-stat">
                                        <div className={"mh-stat-value is-" + snrQuality(mhs.mh_snr)}>{mhs.mh_snr}<small>dB</small></div>
                                        <div className="mc-stat-label">SNR</div>
                                    </div>
                                    <div className="mh-stat">
                                        <div className="mh-stat-value">{mhs.mh_distance}<small>km</small></div>
                                        <div className="mc-stat-label">Dist</div>
                                    </div>
                                </div>

                                <div className="mc-rows">
                                    <div className="mc-row">
                                        <div className="mc-label">Hardware</div>
                                        <div className="mc-value">{mhs.mh_hw}</div>
                                    </div>
                                    <div className="mc-row">
                                        <div className="mc-label">Neighbours</div>
                                        <div className="mc-value">{mhs.mh_ncnt}</div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="mc-empty">
                                <IonIcon icon={cellularOutline} />
                                <div>No nodes heard yet</div>
                            </div>
                        )}
                    </div>
                </IonContent>
            </IonPage>
        </>
    );
};

export default Mheard;
