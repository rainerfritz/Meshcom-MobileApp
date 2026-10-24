import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IonButton, IonProgressBar } from '@ionic/react';
import ReconnectStore from '../store/ReconnectStore';
import AutoReconnectManager from '../utils/AutoReconnectManager';
import { reconnectStatusText } from '../utils/ReconnectText';
import './ReconnectBanner.css';

// Mounted once at the app root (App.tsx). Shows the state of the auto reconnect cycle on every tab,
// with a button to cancel it. It does not block the page.
const ReconnectBanner: React.FC = () => {
  const st = ReconnectStore.useState(s => s);
  const navigate = useNavigate();

  // Cold start with a connection that was up: the reconnect cycle lives on the Connect tab (scan and connect), whatever page
  // the webview was reloaded on. Going there is a no-op if the Connect tab is open already.
  useEffect(() => {
    if (st.coldStartPending) navigate("/connect");
  }, [st.coldStartPending]);

  if (st.state === 'idle') return null;

  return (
    <div className="rec-banner" role="status" aria-live="polite">
      <div className="rec-card">
        <div className="rec-title">Auto reconnect</div>
        <div className="rec-text">{reconnectStatusText(st)}</div>
        <IonProgressBar type="indeterminate" className={st.state === 'weak' ? 'rec-weak' : ''}></IonProgressBar>
        <IonButton className="rec-cancel" size="small" fill="outline" color="danger"
          onClick={() => AutoReconnectManager.getInstance().cancel()}>
          Cancel
        </IonButton>
      </div>
    </div>
  );
};

export default ReconnectBanner;
