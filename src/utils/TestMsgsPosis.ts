
import {MsgType, PosType} from '../utils/AppInterfaces';


export const test_msgs : MsgType [] =
  [
    {
        timestamp:0,
        msgNr:1,
        msgTime:"12:00:00",
        fromCall:"OE1KFR",
        toCall:"",
        msgTXT:"Testmessage for testing",
        via:"OE1KFR-12 > OE1KFR-4",
        ack:0,
        isDM:0,
        notify:0
    },
    {
        timestamp:0,
        msgNr:2,
        msgTime:"12:00:00",
        fromCall:"OE1KFR",
        toCall:"",
        msgTXT:"Testmessage for testing",
        via:"OE1KFR-12 > OE1KFR-4",
        ack:0,
        isDM:0,
        notify:0
    },
    {
        timestamp:0,
        msgNr:3,
        msgTime:"12:00:00",
        fromCall:"xx",
        toCall:"",
        msgTXT:"Testmessage for testing",
        via:"OE1KFR-12 > OE1KFR-4",
        ack:0,
        isDM:0,
        notify:0
    },
    {
        timestamp:0,
        msgNr:4,
        msgTime:"12:00:00",
        fromCall:"OE1KFR",
        toCall:"",
        msgTXT:"Testmessage for testing",
        via:"OE1KFR-12 > OE1KFR-4",
        ack:0,
        isDM:0,
        notify:0
    }
  ]


  export const testPosis:PosType [] = [
    {
        timestamp:0,
        callSign:"OE1KFR-3",
        lat:48.2380,
        lon:16.3167,
        alt:244,
        bat:"N.A.",
        hw:"ESP32",
        pressure:0,
        temperature:0,
        humidity:0,
        qnh:0,
        comment: "Testposition for testing",
        temp_2:0,
        co2:0,
        alt_press:0,
        gas_res:0
    },
    {
        timestamp:0,
        callSign:"OE1KFR-2",
        lat:48.2390,
        lon:16.3167,
        alt:244,
        bat:"N.A.",
        hw:"ESP32",
        pressure:0,
        temperature:0,
        humidity:0,
        qnh:0,
        comment: "Testposition for testing",
        temp_2:0,
        co2:0,
        alt_press:0,
        gas_res:0
    },
    {
        timestamp:0,
        callSign:"OE1XFR-12",
        lat:0.035,
        lon:0.008,
        alt:244,
        bat:"N.A.",
        hw:"ESP32",
        pressure:0,
        temperature:0,
        humidity:0,
        qnh:0,
        comment: "Testposition for testing",
        temp_2:0,
        co2:0,
        alt_press:0,
        gas_res:0
    },
    {
        timestamp:0,
        callSign:"OE1KFR-1",
        lat:0.036,
        lon:0.0167,
        alt:244,
        bat:"N.A.",
        hw:"ESP32",
        pressure:0,
        temperature:999,
        humidity:0,
        qnh:0,
        comment: "Testposition for testing",
        temp_2:0,
        co2:0,
        alt_press:0,
        gas_res:0
    }
  ]