import { useEffect, useRef, useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useStoreState } from 'pullstate';
import BLEconnStore from '../store/BLEconnected';
import { getBLEconnStore, getDiscoAlertRequestCount } from '../store/Selectors';
import AppActiveState from '../store/AppActive';

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

  // automatic: an unexpected (non-manual) BLE disconnect
  useEffect(() => {
    if (!ble_connected) {
      if (wasConnected.current && !BLEconnStore.getRawState().manual_disconnect) {
        setShDiscoCard(true);
      }
    } else {
      // connection restored (elsewhere, or after a device switch) - clear any pending alert
      setShDiscoCard(false);
    }
    wasConnected.current = ble_connected;
  }, [ble_connected]);

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
      message="Node disconnected! Check the BLE Pin and reconnect to Node!"
      buttons={[
        {
          text: "OK"
        },
      ]}
    />
  );
};

export default BleDiscoAlert;
