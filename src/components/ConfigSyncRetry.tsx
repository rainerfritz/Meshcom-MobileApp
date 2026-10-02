import { IonModal, IonProgressBar, IonButton, IonText } from "@ionic/react";
import './ConfigSyncRetry.css';
import { SyncProgress } from "../utils/ConfigSyncWatchdog";

interface ConfigSyncRetryProps {
  progress: SyncProgress | null;
  onCancel: () => void;
}

// shown while the app requests config data from the node again after the sync stalled
export const ConfigSyncRetry: React.FunctionComponent<ConfigSyncRetryProps> = ({ progress, onCancel }) => {

  const done = progress !== null && progress.phase === "done";
  const open = progress !== null;

  const info = progress === null ? "" :
    done
      ? "Config loaded completely."
      : progress.phase === "initial"
        ? "Receiving config from node..."
        : progress.action === "rehello"
        ? "No data received from the node. Sending hello again."
        : "Config from node incomplete. Missing data is requested again (attempt " + progress.round + "/" + progress.maxRounds + ").";

  return (
    <IonModal
      isOpen={open}
      backdropDismiss={false}
      keepContentsMounted={false}
      className="config-sync-retry"
    >
      <div className="config-sync-retry-body">
        <h3>Loading Config</h3>
        <p>{info}</p>
        <IonProgressBar value={progress ? (done ? 1 : progress.received / progress.total) : 0}></IonProgressBar>
        <IonText color="medium">
          <p>{progress ? (done ? progress.total : progress.received) + " / " + progress.total + " received" : ""}</p>
        </IonText>
        {done ? null : <IonButton expand="block" color="danger" onClick={onCancel}>Cancel</IonButton>}
      </div>
    </IonModal>
  );
}

export default ConfigSyncRetry;
