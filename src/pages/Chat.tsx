import { IonButton, IonActionSheet, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonList, IonPage, IonText, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillEnter, IonAlert, useIonViewWillLeave, IonButtons, IonLabel, IonTextarea } from '@ionic/react';
import React,{ useEffect, useRef, useState, createRef } from 'react';
import {ConfType, MsgType, InfoData} from '../utils/AppInterfaces';
import {useBLE} from '../hooks/BleHandler';
import './Chat.css';
import { useStoreState } from 'pullstate';
import { DevIDStore } from '../store';
import { getConfigStore, getDevID, getMsgStore, getPlatformStore } from '../store/Selectors';
import MsgStore from '../store/MsgStore';
import ConfigStore from '../store/ConfStore';
import { checkmark, cloudDoneOutline, cloudOutline, caretForwardCircle, settings, mail, arrowBack, volumeHigh, volumeMute } from 'ionicons/icons';
import { LocalNotifications } from '@capacitor/local-notifications';
import PlatformStore from '../store/PlatformStore';
import { Keyboard } from '@capacitor/keyboard';
import { Clipboard } from '@capacitor/clipboard';
import type { OverlayEventDetail } from '@ionic/core';
import AppActiveState  from '../store/AppActive';
import {MsgTxtLink} from '../components/MsgTxtLink';
import ConfigObject from '../utils/ConfigObject';
import BLEconnStore from '../store/BLEconnected';
import {getBLEconnStore} from '../store/Selectors';
import DMfrmMapStore from '../store/DMfrmMap';
import NotifyMsgState from '../store/NotifyMsg';
import { useHistory } from "react-router";
import LogS from '../utils/LogService';
import DatabaseService from '../DBservices/DataBaseService';
import AlertCard from '../components/AlertCard';
import NodeInfoStore from '../store/NodeInfoStore';
import ChatSettingsStore from '../store/ChatSettingsStore';


const Tab3: React.FC = () => {


  const MAX_CHAR_TEXTINPUT = 150;
  const MAX_CHAR_CALLSIGN = 11;
  const MIN_CHAR_CALLSIGN = 1;


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

  // reference to the textarea input field
  const textAreaInputRef = useRef<HTMLIonTextareaElement>(null);

  // get platform info
  const thisPlatform = useStoreState(PlatformStore, getPlatformStore);

  // store notifypermission
  const canNotify = useRef<boolean>(false);

  // flag we got a new message to fire notification - has full new message object
  const notifyMsg_s = useStoreState(NotifyMsgState, s => s.notifyMsg);

  // state to show callsign on DMs at Textinput
  const [shCallsign, setShCallsign] = useState<boolean>(false);
  // inputref for to callsign
  const callsignInputRef = useRef<HTMLIonInputElement>(null);
  // remember last dm to callsign
  const toCallsign_ = useRef<string>("");
  // last callsign when DM segment was active
  const lastDMcallsign = useRef<string>("");

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

  // alert card params
  const [shDiscoCard, setShDiscoCard] = useState<boolean>(false);

  //const navigation = useIonRouter();
  const history = useHistory();

  // remember if this page is active
  const thisPageActive = useRef<boolean>(false);

  // alertcard handling
  const [shAlertCard, setShAlertCard] = useState<boolean>(false);
  const [alHeader, setAlHeader] = useState<string>("");
  const [alMsg, setAlMsg] = useState<string>("");

  // Nodeinfostore to get the groups subscribed on the node
  const nodeInfo_s:InfoData = useStoreState(NodeInfoStore, s => s.infoData);

  // null = main list; non-null = the active chat filter ("ALL", "DM", or group number)
  const [activeChatFilter, setActiveChatFilter] = useState<string | null>(null);
  // unseen message flags per filter key
  const [unseenFlags, setUnseenFlags] = useState<Record<string, boolean>>({});
  // audio alert flags per channel (true = enabled, default when missing)
  const audioFlags = ChatSettingsStore.useState(s => s.audioFlags);

  // Flag that we send a DM when in DM or group segment
  const [sendDMGrpFlag, setSendDMGrpFlag] = useState<boolean>(false);




  // Tasks we do when we entered the screen.
  useIonViewDidEnter (()=>{
    LogS.log(0,"Chat window did enter");
    thisPageActive.current = true;
    // set the bottom reference
    if(bottomRef.current === null) bottomRef.current = document.getElementById('bottomRefID') as HTMLDivElement;

    // apply any unseen markers set while this page was inactive
    const initSegs: string[] = ConfigObject.getInitChatSegmentMarkers();
    if(initSegs.length > 0){
      const flags: Record<string, boolean> = {};
      initSegs.forEach(seg => { flags[seg] = true; });
      setUnseenFlags(prev => ({ ...prev, ...flags }));
      ConfigObject.clearInitChatSegmentMarkers();
    }

    // load persisted audio settings
    DatabaseService.getChatSettings().then(flags => {
      ChatSettingsStore.update(s => { s.audioFlags = flags; });
    });

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
    }

  });

  // remember that we left the page
  useIonViewWillLeave(()=>{
    thisPageActive.current = false;
  });


  // actions when app goes or comes from background
  useEffect(() => {
    LogS.log(0,"Chat - App active: " + isAppActive);
    // update BLE Hook
    LogS.log(0,"Chat - BLE Connected: " + ble_connected);
    console.log("Chat - BLE DevID: " + devID_s);
    // scroll down if Chat screen gets active again
    if (isAppActive) {

      scrollToBottom();
    } 
  }, [isAppActive]);


  // show discocard if BLE disconnects
  useEffect(() => {
    if(!ble_connected && thisPageActive.current){
      setShDiscoCard(true);
    }
  }, [ble_connected]);



  // always show last message in chat
  const scrollToBottom= async () => {
    if(bottomRef.current === null)
    bottomRef.current = document.getElementById('bottomRefID') as HTMLDivElement;
    if (bottomRef.current) {
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  

  // sending a textmessage
  const sendMsg = async () => {

    if(!ble_connected){
      console.log("BLE not connected");
      setShDiscoCard(true);
      return;
    }
    console.log("Sending Message");
    console.log("shCallsign: " + shCallsign);
    console.log("sendDMGrpFlag: " + sendDMGrpFlag);
    let isDM = false;
    let toCallsign_str_u = "";

    // only active when we are in the DM segment
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
              lastDMcallsign.current = toCallsign_str_u;
              isDM = true;

              console.log("To Callsign: " + toCallsign_str_u);
              console.log("isDM: " + isDM);
            }
          }
        }
      }
    }

    // sending of group message when in group segment as DM
    if(sendDMGrpFlag){
      isDM = true;
      toCallsign_str_u = toCallsign_.current;
      console.log("Group Message to Group: " + toCallsign_str_u);
    }
    

    if(textAreaInputRef !== null){
      
      const txMsg = textAreaInputRef.current!.value;

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

            LogS.log(0,"CHAT SendMsg: " + final_msg_str);

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

            try {
              await sendDV(view1, ConfigObject.getBleDevId());
            } catch (error) {
              LogS.log(1,"CHAT - Error sending message to node: " + error);
              setAlHeader("Error sending message");
              setAlMsg("Error sending message to node: " + error);
              setShAlertCard(true);
              return;
            }

            // add message to queue
            //addMsgQueue(final_msg_str);

            // clear input
            //textInputRef.current!.value = "";
            textAreaInputRef.current!.value = "";

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
    LogS.log(0,"Chat - Mounted Page");
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
        // silent channel used when audio alerts are disabled for a chat
        await LocalNotifications.createChannel({
          id: 'silent',
          name: 'channel_silent',
          importance: 3,
          visibility: 1,
          vibration: false,
          sound: ''
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
      console.log("Chat - New Message Arrived");          

      scrollToBottom();
    }

  }, [msgArr_s]);


  // Trigger that we fire a notification on new message
  useEffect(() => {
    console.log("CHAT - New Message to Notify: ");
    console.log(notifyMsg_s);

    // if a message arrives in another segment than the current one set the background color class to indicate new message
    if (notifyMsg_s.msgNr === 0) return; // skip default/initial state

    if (notifyMsg_s.isDM !== undefined && notifyMsg_s.isGrpMsg !== undefined) {

      let msgType = "ALL";

      if (notifyMsg_s.isDM === 0 && notifyMsg_s.isGrpMsg === 0) {
        msgType = "ALL";
      }
      else if (notifyMsg_s.isDM === 1 && notifyMsg_s.isGrpMsg === 0) {
        msgType = "DM";
      }
      else if (notifyMsg_s.isGrpMsg === 1 && notifyMsg_s.isDM === 1) {
        msgType = notifyMsg_s.grpNum.toString();
      }

      console.log("Message Type: " + msgType);

      const audioOn = ChatSettingsStore.getRawState().audioFlags[msgType] !== false;
      const notify_title = "New Message from " + notifyMsg_s.fromCall;
      notifyMsgUser(notify_title, notifyMsg_s.msgTXT, audioOn);

      if (msgType !== activeChatFilter) {
        setUnseenFlags(prev => ({ ...prev, [msgType]: true }));
      }
    }

  }, [notifyMsg_s.msgNr]);


  // local notification method — playSound controls whether sound is included
  const notifyMsgUser = async (title_:string, body_:string, playSound: boolean = true) => {
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
              ...(playSound ? { sound: 'default' } : {}),
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
              channelId: playSound ? '1' : 'silent',
              smallIcon: 'res://drawable/meshcom_logo_32x32_transp_gray',
              largeIcon: 'res://drawable/meshcom_logo_64x64',
              sound: playSound ? 'morse_r.wav' : ''
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



  // handle actionsheet result copy text / send DM for specific message
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

      if (asActionDetail === "resend") {
        console.log("Resend pressed");
        const resendTxt = selMsg[0].msgTXT;
        // Fill message text into the textarea
        if (textAreaInputRef.current) {
          textAreaInputRef.current.value = resendTxt;
        }
        // If DM segment is active, fill toCall (the original recipient) into To Callsign input
        if (activeChatFilter === "DM") {
          const toCallResend = selMsg[0].toCall;
          toCallsign_.current = toCallResend;
          lastDMcallsign.current = toCallResend;
          setShCallsign(true);
          if (callsignInputRef.current) {
            callsignInputRef.current.value = toCallResend;
          }
        }
      }

      if (asActionDetail === "replyTo") {
        console.log("Reply To pressed");
        const replyToCall = selMsg[0].fromCall;
        toCallsign_.current = replyToCall;
        lastDMcallsign.current = replyToCall;
        setShCallsign(true);
        if (callsignInputRef.current) {
          callsignInputRef.current.value = replyToCall;
        }
      }

      if (asActionDetail === "sendDM") {
        console.log("DM pressed");
        let selCall = "";

        if(selMsg[0].fromCall === config_s.callSign){
          selCall = selMsg[0].toCall;
        } else {
          selCall = selMsg[0].fromCall;
        }
        
        console.log("DM to Callsign: " + selCall);
        toCallsign_.current = selCall;
        lastDMcallsign.current = selCall;
        setIsOpenAS(false);

        if(activeChatFilter !== "DM"){
          handleSegmentChange("DM", false);
        }

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


  // redirect to connect page if unset node
  const redirectConnect = () => {
    setShDiscoCard(false);
    if (isAppActive)
      history.push("/connect");
  }


  // handle no Db connection in offline mode - no node connected
  const handleNoDbConnFilter = () => {
    setAlHeader("No Database Connection");
    setAlMsg("Filtering is only available if a node is connected!");
    setShAlertCard(true);
  }


  const modalDidDismiss = () => {
    scrollToBottom();
  }

  const handleSegmentChange = (val: string, isGrp: boolean) => {
    console.log("Chat Filter Change to: " + val);
    setActiveChatFilter(val);

    DatabaseService.setChatFilters(val);

    if (val === "ALL") {
      setShCallsign(false);
      setSendDMGrpFlag(false);
    }

    if (val === "DM") {
      toCallsign_.current = lastDMcallsign.current;
      setShCallsign(true);
    } else {
      setShCallsign(false);
    }

    if (isGrp) {
      setSendDMGrpFlag(true);
      toCallsign_.current = val;
    } else {
      setSendDMGrpFlag(false);
    }

    // clear unseen flag for this filter now that we're viewing it
    setUnseenFlags(prev => ({ ...prev, [val]: false }));

    // delay until chat DOM is rendered
    setTimeout(() => scrollToBottom(), 100);
  }

  const goBackToList = () => {
    setActiveChatFilter(null);
    setShCallsign(false);
    setSendDMGrpFlag(false);
  }

  const toggleAudio = (channel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = audioFlags[channel] !== false; // missing key = enabled by default
    const next = !current;
    ChatSettingsStore.update(s => { s.audioFlags = { ...s.audioFlags, [channel]: next }; });
    DatabaseService.setChatAudio(channel, next);
  }
  


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          {activeChatFilter !== null && (
            <IonButtons slot="start">
              <IonButton onClick={goBackToList}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            </IonButtons>
          )}
          <IonTitle>
            {activeChatFilter === null ? "Chat" :
             activeChatFilter === "ALL" ? "All Messages" :
             activeChatFilter === "DM" ? "Direct Messages" :
             `Group ${activeChatFilter}`}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">

        <IonAlert
          isOpen={shDiscoCard}
          onDidDismiss={() => redirectConnect()}
          header="BLE Disconnect"
          message="Node disconnected! Auto-Reconnect is disabled currently."
          buttons={[
            {
              text: "OK"
            },
          ]}
        />

        <AlertCard
          isOpen={shAlertCard}
          header={alHeader}
          message={alMsg}
          onDismiss={() => setShAlertCard(false)}
        />        

        <IonActionSheet
          isOpen={isOpenAS}
          buttons={[
            {
              text: 'Copy Text',
              data: {
                action: 'copy',
              },
            },
            ...(msgArr_s.some(m => m.msgNr === msgNrAS && m.fromCall === nodeInfo_s.CALL) ? [{
              text: 'Resend Message',
              data: {
                action: 'resend',
              },
            }] : []),
            ...(activeChatFilter !== "DM" ? [{
              text: 'Direct Message',
              data: {
                action: 'sendDM',
              },
            }] : []),
            ...(activeChatFilter === "DM" ? [{
              text: 'Reply To',
              data: {
                action: 'replyTo',
              },
            }] : []),
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


        {activeChatFilter === null ? (
          <IonList>
            <IonItem className="chat-list-item" button onClick={() => handleSegmentChange("ALL", false)}>
              {unseenFlags["ALL"] && <IonIcon icon={mail} color="success" slot="start" />}
              <IonLabel>To All Channel</IonLabel>
              <IonButton slot="end" fill="clear" onClick={e => toggleAudio("ALL", e)}>
                <IonIcon icon={audioFlags["ALL"] !== false ? volumeHigh : volumeMute} color={audioFlags["ALL"] !== false ? "primary" : "medium"} />
              </IonButton>
            </IonItem>
            <IonItem className="chat-list-item" button onClick={() => handleSegmentChange("DM", false)}>
              {unseenFlags["DM"] && <IonIcon icon={mail} color="success" slot="start" />}
              <IonLabel>Direct Messages</IonLabel>
              <IonButton slot="end" fill="clear" onClick={e => toggleAudio("DM", e)}>
                <IonIcon icon={audioFlags["DM"] !== false ? volumeHigh : volumeMute} color={audioFlags["DM"] !== false ? "primary" : "medium"} />
              </IonButton>
            </IonItem>
            {nodeInfo_s.GCB0 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB0.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB0.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB0}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB0.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB0.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB0.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
            {nodeInfo_s.GCB1 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB1.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB1.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB1}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB1.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB1.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB1.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
            {nodeInfo_s.GCB2 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB2.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB2.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB2}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB2.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB2.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB2.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
            {nodeInfo_s.GCB3 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB3.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB3.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB3}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB3.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB3.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB3.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
            {nodeInfo_s.GCB4 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB4.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB4.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB4}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB4.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB4.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB4.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
            {nodeInfo_s.GCB5 !== 0 && (
              <IonItem className="chat-list-item" button onClick={() => handleSegmentChange(nodeInfo_s.GCB5.toString(), true)}>
                {unseenFlags[nodeInfo_s.GCB5.toString()] && <IonIcon icon={mail} color="success" slot="start" />}
                <IonLabel>Group {nodeInfo_s.GCB5}</IonLabel>
                <IonButton slot="end" fill="clear" onClick={e => toggleAudio(nodeInfo_s.GCB5.toString(), e)}>
                  <IonIcon icon={audioFlags[nodeInfo_s.GCB5.toString()] !== false ? volumeHigh : volumeMute} color={audioFlags[nodeInfo_s.GCB5.toString()] !== false ? "primary" : "medium"} />
                </IonButton>
              </IonItem>
            )}
          </IonList>
        ) : (
          <>
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
                            {(activeChatFilter === "ALL" || activeChatFilter === "DM") && (
                              <div className="ion-text-start">
                                <IonText id="from-call">To: {msg.toCall}</IonText>
                              </div>
                            )}
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
            <div ref={bottomRef} id="bottomRefID"/>
          </>
        )}
      </IonContent>

      {activeChatFilter !== null && (
      <IonFooter>
        <div className="send-text">

          <div className='input_bar'>
            {shCallsign &&
              <div className="textarea_field">
                <IonItem>
                  <IonInput
                    className='custominput'
                    ref={callsignInputRef}
                    placeholder='To Callsign'
                    type='text'
                    maxlength={MAX_CHAR_CALLSIGN}
                    onIonInput={(ev) => handleInput(ev)}
                    disabled={!ble_connected}
                    value={toCallsign_.current}>
                  </IonInput>
                </IonItem>
              </div>}

            <div className="textarea_field">
              <IonItem>
                <IonTextarea 
                  className='customTextAreaInput'
                  ref={textAreaInputRef}
                  autoCorrect='on' 
                  spellcheck={true} 
                  autoGrow={true} 
                  maxlength={MAX_CHAR_TEXTINPUT} 
                  rows={1}
                  placeholder='Type Message'
                  disabled={!ble_connected}>
                </IonTextarea>
              </IonItem>
            </div>
          </div>

          <div className='send_btn'>
            <IonIcon slot='end' icon={caretForwardCircle} onClick={() => sendMsg()} {...{ color: ble_connected ? "primary" : "danger" }} size='large'></IonIcon>
          </div>
        </div>
      </IonFooter>
      )}
      
    </IonPage>
  );
};

export default Tab3;
