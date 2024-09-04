import { IonButton, IonActionSheet, IonContent, IonFooter, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonPage, IonText, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillEnter } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import {ConfType, MsgType} from '../utils/AppInterfaces';
import {useBLE} from '../hooks/BleHandler';
import './Chat.css';
import { useStoreState } from 'pullstate';
import { DevIDStore } from '../store';
import { getConfigStore, getDevID, getLastNotifyID, getMsgStore, getPlatformStore } from '../store/Selectors';
import MsgStore from '../store/MsgStore';
import ConfigStore from '../store/ConfStore';
import { checkmark, cloudDoneOutline, cloudOutline, caretForwardCircle} from 'ionicons/icons';
import { LocalNotifications } from '@capacitor/local-notifications';
import PlatformStore from '../store/PlatformStore';
import LastNotifyID from '../store/LastNotifyID';
import { Keyboard } from '@capacitor/keyboard';
import { Clipboard } from '@capacitor/clipboard';
import type { OverlayEventDetail } from '@ionic/core';
import AppActiveState  from '../store/AppActive';
import {MsgTxtLink} from '../components/MsgTxtLink';
import ConfigObject from '../utils/ConfigObject';
import BLEconnStore from '../store/BLEconnected';
import {getBLEconnStore} from '../store/Selectors';
import DatabaseService from '../DBservices/DataBaseService';
import DMfrmMapStore from '../store/DMfrmMap';
import BleConfigFinish from '../store/BLEConfFin';
import NotifyMsgState from '../store/NotifyMsg';



const Tab3: React.FC = () => {


  const MAX_CHAR_TEXTINPUT = 150;
  const MAX_CHAR_CALLSIGN = 11;
  const MIN_CHAR_CALLSIGN = 3;


  const {sendDV, updateDevID, sendTxtCmdNode} = useBLE();


  // devid from store
  const devID_s = useStoreState(DevIDStore, getDevID);
  
  // msgs from store
  const msgArr_s:MsgType[] = useStoreState(MsgStore, getMsgStore);

  // get config for node callsign. need to know if the message in store is ours
  const config_s:ConfType = useStoreState(ConfigStore, getConfigStore);

  // get current AppState
  const isAppActive = AppActiveState.useState(s => s.active);

  // BLE connected from store
  const ble_connected:boolean = useStoreState(BLEconnStore, getBLEconnStore);

  // reference to text input field
  const textInputRef = useRef<HTMLIonInputElement>(null);

  // get platform info
  const thisPlatform = useStoreState(PlatformStore, getPlatformStore);

  // store notifypermission
  const canNotify = useRef<boolean>(false);

  // flag we got a new message to fire notification - has full new message object
  const notifyMsg_s = useStoreState(NotifyMsgState, s => s.notifyMsg);

  // store last MsgID in gloabl State to avoid notifies on page change
  const lastNotifyID_s = useStoreState(LastNotifyID, getLastNotifyID);

  // state to show callsign on DMs at Textinput
  const [shCallsign, setShCallsign] = useState<boolean>(false);
  // inputref for to callsign
  const callsignInputRef = useRef<HTMLIonInputElement>(null);
  // remember last dm to callsign
  const toCallsign_ = useRef<string>("");

  // longpress event
  const MIN_PRESS_TIME = 800; //ms
  //actionsheet
  const [isOpenAS, setIsOpenAS] = useState(false);
  // message number from long press event
  const [msgNrAS, setMsgNrAS] = useState<number>();

  // handle keyboard events and place chat accordingly
  const [chatBoxPadding, setchatBoxPadding] = useState("3px");

  // remember that keyboard is already open on rerenders
  const keyBopen = useRef<boolean>(false);

  // reference to bottom of chat
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // DM callsign trigger from Map
  const dmFrmMap_ = DMfrmMapStore.useState(s => s.dmfDMfrmMap);

  // stores the last timestamp of a message in chat to insert date panel
  const lastMsgTime = useRef<number>(Date.now());




  // scroll down when we enter the chat
  useIonViewDidEnter (()=>{
    console.log("Chat window did enter");
    //const devid = devID_s;
    //updateDevID(devid);
    scrollToBottom();
  });


  // do everything we need to do before entering the screen
  useIonViewWillEnter(()=>{
    // on android we need to create a channel to play custom sound
    if(thisPlatform){
      console.log("Platform at chat: " + thisPlatform);
      hasNotifyPermission();
      //scrollToBottom();
    }
  });


  // actions when app goes or comes from background
  useEffect(() => {
    console.log("Chat App active: " + isAppActive);
    // update BLE Hook
    console.log("Chat - BLE Connected: " + ble_connected);
    console.log("Chat - BLE DevID: " + devID_s);
    // scroll down if Chat screen gets active again
    if(isAppActive){
      scrollToBottom();
    } 
  }, [isAppActive]);



  // always show last message in chat
  const scrollToBottom= async () => {
    //document.getElementById('bottom')!.scrollIntoView({ behavior: 'smooth', block: 'center' });
    /*if (contentRef.current) {
      contentRef.current.scrollToBottom(400);
    }*/
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  

  // sending a textmessage
  const sendMsg = () => {

    console.log("Sending Message");
    console.log("shCallsign: " + shCallsign);
    let isDM = false;
    let toCallsign_str_u = "";

    if (shCallsign) {
      // check if we have a DM and remember callsign. we only send the DM when the DM button is active
      if (callsignInputRef !== null) {

        const toCallsign_ref = callsignInputRef.current!.value;

        if (toCallsign_ref !== null) {

          if (toCallsign_ref) {

            let toCallsign_str = toCallsign_ref.toString();
            toCallsign_str = toCallsign_str.trim();

            console.log("ToCall: " + toCallsign_str);

            if (toCallsign_str.length >= MIN_CHAR_CALLSIGN) {

              toCallsign_str_u = toCallsign_str.toUpperCase();
              toCallsign_.current = toCallsign_str_u;
              isDM = true;

              console.log("To Callsign: " + toCallsign_str_u);
              console.log("isDM: " + isDM);
            }
          }
        }
      }
    }
    

    if(textInputRef !== null){
      
      const txMsg = textInputRef.current!.value;

      if(txMsg){

        if(txMsg !== null ){

          let txMsg_str = txMsg.toString();

          let final_msg_str = "";

          if(txMsg_str.length > 0){

            //console.log("DM Message state: " + shCallsign);
            if(isDM){
              final_msg_str = "{" + toCallsign_str_u + "}" + txMsg_str;
            } else {
              final_msg_str = txMsg_str;
            }

            console.log("CHAT Msg: " + final_msg_str);

            let txt_enc = new TextEncoder(); // always utf-8
            const enc_txt_msg = txt_enc.encode(final_msg_str);
            console.log("UTF-8 Encoded Msg: " + enc_txt_msg);
    
            const txt_len = enc_txt_msg.length;
            const txt_buffer = new ArrayBuffer(txt_len + 2);
    
            let view1 = new DataView(txt_buffer);
            view1.setUint8(0, txt_len + 2);
            view1.setUint8(1, 0xA0);
    
            for(let i=0; i<txt_len; i++)
              view1.setUint8(i+2, enc_txt_msg[i]);

            sendDV(view1, ConfigObject.getBleDevId());

            // add message to queue
            //addMsgQueue(final_msg_str);

            // clear input
            textInputRef.current!.value = "";

            // close dm input
            //setShCallsign(false);
            // close keyboard
            Keyboard.hide();
            
            //scrollToBottom();
            
          }
        }
      }
    }
  }



  // run once at mount - setup listeners and handle CSS id change of chatbox
  useEffect(() => {
    // check if keyboard hides
    Keyboard.addListener('keyboardDidHide', () => {

      console.log('keyboard did hide');
      const newPading = "3px";
      console.log("new Padding: " + newPading)
      setchatBoxPadding(newPading);
      scrollToBottom();
      keyBopen.current = false;
    });

    Keyboard.addListener('keyboardDidShow', info => {

      console.log('keyboard open with height:', info.keyboardHeight);
      console.log("Keybopen: " + keyBopen.current);

      if (!keyBopen.current) {
        
        keyBopen.current = true;
        let newPading = info.keyboardHeight;

        if (shCallsign) newPading = newPading + 50;
        const newPadding_str = newPading + "px";
        console.log("new Padding: " + newPadding_str);
        setchatBoxPadding(newPadding_str);

        scrollToBottom();
        const newPading1 = "3px";
        setchatBoxPadding(newPading1);
      }
    });
  }, []);




  // check if we have permission for notifications
  const hasNotifyPermission = async () => {

    if((await LocalNotifications.checkPermissions()).display === 'granted'){
      console.log("Local Notification are granted");
      canNotify.current = true;

      //create a channel for notify on adroid
      if (thisPlatform === "android") {
        await LocalNotifications.createChannel({
          id: '1',
          name: 'channel1',
          importance: 4,
          visibility: 1,
          vibration: true,
          sound: 'morse_r.wav'
        });
        // sound: "android.resource://io.ionic.meshcom/raw/morse_r.wav"
        const channels = await LocalNotifications.listChannels();
        console.log("Channels:");
        for (let ch of channels.channels) {
          console.log("id: " + ch.id);
          console.log("importance " + ch.importance);
          console.log("sound " + ch.sound);
          console.log("visibility " + ch.visibility);
        }
      }
    } else {
      // TODO action when no permission for notifies is set
      console.log("No Notify Permission set!");
      
    }
  }


  // scroll to bottom if new message arrives
  useEffect(() => {

    if (msgArr_s && msgArr_s.length > 0) {

      scrollToBottom();
    }
  }, [msgArr_s]);


  // Trigger that we fire a notification on new message
  useEffect(() => {
    console.log("CHAT - New Message to Notify: ");
    console.log(notifyMsg_s);
    const notify_title = "New Message from " + notifyMsg_s.fromCall;
    notifyMsgUser(notify_title, notifyMsg_s.msgTXT);
  }, [notifyMsg_s.msgNr]);


  // local notification method
  const notifyMsgUser = async (title_:string, body_:string) => {
    if(canNotify.current === true){
      if(thisPlatform === "ios"){
        LocalNotifications.schedule({
          notifications: [
            {
              title:title_,
              body: body_,
              id: Math.floor(Math.random() * 600000),
              schedule: {
                at: new Date(Date.now() + 1000 * 1), // in 1 secs
                repeats: false
              },
              sound:''
            }]
        });
      }

      if(thisPlatform === "android"){
        LocalNotifications.schedule({
          notifications: [
            {
              title: title_,
              body: body_,
              id: Math.floor(Math.random() * 600000),
              schedule: {
                at: new Date(Date.now() + 1000 * 1), // in 1 secs
                repeats: false
              },
              channelId: '1',
              smallIcon: 'res://drawable/meshcom_logo_32x32_transp_gray',
              largeIcon: 'res://drawable/meshcom_logo_64x64',
              sound: 'morse_r.wav'
            }]
        });
      }
    }
  }


  // switch message type - own - own/dm - other
  const msgType = (msg_:MsgType) =>{

    if(msg_.fromCall === config_s.callSign) return "own-message";

    if(msg_.fromCall !== config_s.callSign) {
      if(msg_.isDM) {
        return "dm-message"
      } else {
        return "other-message"
      }
    }
  }


  // handle the Direct Message Button from the map
  useEffect(() => {
    if(dmFrmMap_.shDMfrmMap){
      console.log("Chat - DM from Map to Call: " + dmFrmMap_.dmCallMap);
      toCallsign_.current = dmFrmMap_.dmCallMap;
      setShCallsign(true);
      DMfrmMapStore.update(s => {
        s.dmfDMfrmMap.shDMfrmMap = false;
      });
    }
  }, [dmFrmMap_]);



  // LongPress Handling on Messages to fire actionsheet
  let btnpresstime = 0;

  const handleButtonPress = () => {
    btnpresstime = Date.now();
    console.log("Long Press time start: " + btnpresstime);
  }

  // check how long clicked on a message to show options
  const handleButtonRelease = (msgNr: number) => {

    const btnstop = Date.now();
    const difftime = btnstop - btnpresstime;
    console.log("Long Press time stop: " + btnstop);
    console.log("Diff: " + difftime);

    if (difftime >= MIN_PRESS_TIME) { // is click
      console.log('selected msgnr: ' + msgNr);
      setMsgNrAS(msgNr);
      setIsOpenAS(true);
    }
  }



  // handle actionsheet result
  const handleActionSheet = (detailAS: OverlayEventDetail) => {

    console.log("AS Detail: ");
    console.log(detailAS);

    if (detailAS.data) {

      const asActionDetail = detailAS.data.action;
      const selMsg = msgArr_s.filter(msgs => msgs.msgNr === msgNrAS);
      console.log(asActionDetail);

      if (asActionDetail === "copy") {
        console.log("Copy pressed");
        const copyTxt = selMsg[0].msgTXT;
        console.log(copyTxt);
        writeToClipboard(copyTxt);
      }

      if (asActionDetail === "sendDM") {
        console.log("DM pressed");
        let selCall = "";

        if(selMsg[0].fromCall === config_s.callSign){
          selCall = selMsg[0].toCall;
        } else {
          selCall = selMsg[0].fromCall;
          console.log("To Call: " + selMsg[0].toCall);
          // check for group message to set the group number
          if(!isNaN(+selMsg[0].toCall) && selMsg[0].toCall !== "") selCall = selMsg[0].toCall;
        }
        
        console.log("DM to Callsign: " + selCall);
        toCallsign_.current = selCall;
        setIsOpenAS(false);
        setShCallsign(true);
      }
    }
    setIsOpenAS(false);
  }
  


  // write to clipboard - msg text copy
  const writeToClipboard = async (copytext:string) => {
    await Clipboard.write({
      string: copytext
    });
  };



  // handle dm to callsign input
  const handleInput = (ev:Event) =>{

    let inp = '';
    const target = ev.target as HTMLIonInputElement;
    if (target) inp = target.value!.toString();

    console.log("Input: " + inp);
    toCallsign_.current = inp;
  }


  // check if timestamps of two text messages have midnight in between to show date
  const checkMidnight = (msg:MsgType) => {

    const day_msg = new Date(msg.timestamp);
    const day_last = new Date(lastMsgTime.current);

    if(day_msg.getDate() !== day_last.getDate()){
      lastMsgTime.current = msg.timestamp;
      return true;
    } else {
      return false;
    }
  }


  // return the date panel
  const getLocalDate = (msg:MsgType) : string => {
    const localDateString:string = new Date(msg.timestamp).toLocaleDateString();
    return localDateString;
  }


  


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Messages</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Messages</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonActionSheet
          isOpen={isOpenAS}
          buttons={[
            {
              text: 'Copy Text',
              data: {
                action: 'copy',
              },
            },
            {
              text: 'Direct Message',
              data: {
                action: 'sendDM',
              },
            },
            {
              text: 'Cancel',
              role: 'cancel',
              data: {
                action: 'cancel',
              },
            },
          ]}
          onDidDismiss={({ detail }) => handleActionSheet(detail)}
        ></IonActionSheet>

        <div id="spacer-top"></div>
        <div id="msg-box" >

          {msgArr_s.map((msg, i) => (
            <>
              {checkMidnight(msg) &&
                <div className="date-panel">
                  <IonText id="msg-time">{getLocalDate(msg)}</IonText>
                </div>}

              {msg.msgNr !== 0 ? <>

                <div key={i} onTouchStart={handleButtonPress} onTouchEnd={() => handleButtonRelease(msg.msgNr)} className={msgType(msg)}>

                  {msg.isDM ? <>
                    {!isNaN(+msg.toCall) ? <>
                      <div className="ion-text-start">
                      <IonText id="msg-dm">GROUP-MESSAGE {msg.toCall}</IonText>
                    </div>
                    </>:<>
                    <div className="ion-text-start">
                      <IonText id="msg-dm">DIRECT-MESSAGE</IonText>
                    </div>
                    </>}
                  </> : <></>}

                  <div className="ion-text-start">
                    <IonText id="msg-time">{msg.msgTime}</IonText>
                  </div>
                  {msg.via.length > 1 ? <>
                    <div className="ion-text-start">
                      <IonText id="msg-via">via:{msg.via}</IonText>
                    </div>
                  </> : <></>}

                  <div className="ion-text-start">
                    {msg.isDM ? <>
                      {msg.fromCall === config_s.callSign ? <>
                        <div className="ion-text-start">
                        <IonText id="from-call">To: {msg.toCall}</IonText>
                        </div>
                      </>:<>
                      <IonText id="from-call" >{msg.fromCall}: </IonText>
                      </>}
                    </> : <>
                    <IonText id="from-call" >{msg.fromCall}: </IonText>
                    </>}
                    
                  </div>

                  <div id="spacer-txtbox"></div>

                  <div className="msg_text">
                    
                    <MsgTxtLink msgTxt={msg.msgTXT} />
                    
                  </div>
                  <div className='chkIcon'>

                    {msg.fromCall === config_s.callSign ? <>
                      {msg.ack === 0 ? <>
                        <IonIcon icon={checkmark} id="chkIcon" size='small' slot='end' />
                      </> : <></>}
                      {msg.ack === 1 ? <>
                        <IonIcon icon={cloudOutline} id="chkIcon" size='small' slot='end' />
                      </> : <></>}
                      {msg.ack === 2 ? <>
                        <IonIcon icon={cloudDoneOutline} id="chkIcon" size='small' slot='end' />
                      </> : <></>}
                    </> : <></>}
                  </div>
                </div>

              </> : <></>}

            </>
          ))}

        </div>
        <div id="bottom" style={{ height: chatBoxPadding }}/>
        <div ref={bottomRef}/>
      </IonContent>

      <IonFooter>
        <div className="send-text">

          <div className='dm_btn'>
            <IonButton 
              slot='start' 
              onClick={() => setShCallsign(!shCallsign)} 
              size='small' 
              fill="outline" {...{ color: shCallsign ? "success" : "primary" }}>DM</IonButton>
          </div>

          <div className='input_bar'>
            {shCallsign &&
              <div className="dm_call">
                <IonItem>
                  <IonInput
                    className='custominput'
                    ref={callsignInputRef}
                    label='To Callsign or Group'
                    labelPlacement="stacked"
                    type='text'
                    maxlength={MAX_CHAR_CALLSIGN}
                    onIonInput={(ev) => handleInput(ev)}
                    value={toCallsign_.current}>
                  </IonInput>
                </IonItem>
              </div>}

            <div>
              <IonItem>
                <IonInput
                  className='custominput'
                  ref={textInputRef}
                  label='Type Message'
                  labelPlacement="stacked"
                  type='text'
                  autocorrect='on'
                  maxlength={MAX_CHAR_TEXTINPUT}>
                </IonInput>
              </IonItem>
            </div>
          </div>

          <div className='send_btn'>
            <IonIcon slot='end' icon={caretForwardCircle} onClick={() => sendMsg()} color='primary' size='large'></IonIcon>
          </div>
        </div>
      </IonFooter>
      
    </IonPage>
  );
};

export default Tab3;
