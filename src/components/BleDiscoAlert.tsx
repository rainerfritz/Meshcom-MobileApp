import { useEffect, useRef, useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useStoreState } from 'pullstate';
import BLEconnStore from '../store/BLEconnected';
import { getBLEconnStore, getDiscoAlertRequestCount } from '../store/Selectors';
import AppActiveState from '../store/AppActive';
import ReconnectStore from '../store/ReconnectStore';
import { reconnectResultText } from '../utils/ReconnectText';

// Single, app-wide BLE-disconnect alert. Mounted once at the app root (see App.tsx) so it
// shows regardless of which tab is currently visible, instead of being duplicated per page.
const BleDiscoAlert: React.FC = () => {
  const navigate = useNavigate();
  const isAppActive = AppActiveState.useState(s => s.active);
  const ble_connected: boolean = useStoreState(BLEconnStore, getBLEconnStore);
  const discoAlertRequestCount: number = useStoreState(BLEconnStore, getDiscoAlertRequestCount);
  const [shDiscoCard, setShDiscoCard] = useState<boolean>(false);
  // tracks whether we were ever actually connected, so a disconnect-from-never-connected
  // (e.g. app just started, nothing connected yet) doesn't look like a "disconnect"
  const wasConnected = useRef<boolean>(false);

  // state of the auto reconnect cycle. While it runs, the ReconnectBanner tells the user what happens
  const recState = ReconnectStore.useState(s => s.state);
  const recResult = ReconnectStore.useState(s => s.lastResult);
  const recRssi = ReconnectStore.useState(s => s.rssi);

  // automatic: an unexpected (non-manual) BLE disconnect
  useEffect(() => {
    if (!ble_connected) {
      // no alert while a reconnect cycle searches for the node. It shows up when the cycle ends without connection
      if (wasConnected.current && !BLEconnStore.getRawState().manual_disconnect
        && ReconnectStore.getRawState().state === 'idle') {
        setShDiscoCard(true);
      }
    } else {
      // connection restored (elsewhere, or after a device switch) - clear any pending alert
      setShDiscoCard(false);
    }
    wasConnected.current = ble_connected;
  }, [ble_connected]);

  // the reconnect cycle: hide the alert while it runs, show why it gave up when it ends without connection
  useEffect(() => {
    if (recState !== 'idle') {
      setShDiscoCard(false);
    } else if (recResult !== null && !BLEconnStore.getRawState().ble_connected) {
      setShDiscoCard(true);
    }
  }, [recState, recResult]);

  // explicit: a page asked to (re-)show the alert, e.g. Chat.tsx's sendMsg() while disconnected
  useEffect(() => {
    if (discoAlertRequestCount > 0) {
      setShDiscoCard(true);
    }
  }, [discoAlertRequestCount]);

  const redirectConnect = () => {
    setShDiscoCard(false);
    if (isAppActive) navigate("/connect");
  };

  return (
    <IonAlert
      isOpen={shDiscoCard}
      onDidDismiss={() => redirectConnect()}
      header="BLE Disconnect"
      message={reconnectResultText(recResult, recRssi) ?? "Node disconnected! Check the BLE Pin and reconnect to Node!"}
      buttons={[
        {
          text: "OK"
        },
      ]}
    />
  );
};

export default BleDiscoAlert;
