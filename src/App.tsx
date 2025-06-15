import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { chatboxEllipses, bluetooth, settings, globe, move, informationCircleOutline } from 'ionicons/icons';
import Tab1 from './pages/Connect';
import Tab2 from './pages/Settings';
import Tab3 from './pages/Chat';
import Mheard from './pages/Mheard';
import Info from './pages/Info';
import Map from './pages/Map';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

// AppState Fore-Background
import AppActiveState from './store/AppActive';
import { useEffect } from 'react';
import { App } from '@capacitor/app';

import DataBaseService from './DBservices/DataBaseService';



setupIonicReact();

const Appl: React.FC = () => {
  


  // set initial app is axctive state and add event listener
  useEffect(() => {
    // init DB
    const initDB = async () => {
      console.log('Initializing Database');
      await DataBaseService.initializeDatabase();
    };
    // call init DB
    initDB();
    
    // check wether app is in background or not
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
      // update config in store state
      const newAppstate = isActive;
      AppActiveState.update(s => {
        s.active = newAppstate;
      });
    });
  }, []);


  return (

    <IonApp>
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/connect">
            <Tab1 />
          </Route>
          <Route exact path="/settings">
            <Tab2 />
          </Route>
          <Route path="/chat">
            <Tab3 />
          </Route>
          <Route path="/map">
            <Map />
          </Route>
          <Route path="/mheard">
            <Mheard />
          </Route>
          <Route path="/info">
            <Info />
          </Route>
          <Route exact path="/">
            <Redirect to="/connect" />
          </Route>
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          <IonTabButton tab="tab1" href="/connect">
            <IonIcon aria-hidden="true" icon={bluetooth} />
            <IonLabel>connect</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab2" href="/settings">
            <IonIcon aria-hidden="true" icon={settings} />
            <IonLabel>settings</IonLabel>
          </IonTabButton>
          <IonTabButton tab="info" href="/info">
            <IonIcon aria-hidden="true" icon={informationCircleOutline} />
            <IonLabel>Info</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab3" href="/chat">
            <IonIcon aria-hidden="true" icon={chatboxEllipses} />
            <IonLabel>chat</IonLabel>
          </IonTabButton>
          <IonTabButton tab="map" href="/map">
            <IonIcon aria-hidden="true" icon={globe} />
            <IonLabel>Map</IonLabel>
          </IonTabButton>
          <IonTabButton tab="mheard" href="/mheard">
            <IonIcon aria-hidden="true" icon={move} />
            <IonLabel>Mheard</IonLabel>
          </IonTabButton>
          
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  </IonApp>

)};

export default Appl;
