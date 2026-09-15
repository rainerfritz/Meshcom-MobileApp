
import {MsgType, PosType} from '../utils/AppInterfaces';


/**
 * Demo messages for checking the chat bubble design without a connected node.
 * Only used when INJECT_TEST_MSGS is switched on in Chat.tsx - they live in the Pullstate
 * store only and are never written to the database.
 *
 * ownCall has to be the configured callsign, otherwise the "own" messages would render as
 * received ones. channel is the active chat filter ("ALL", "DM" or a group number) so the
 * DM/group flags match the channel that is currently open.
 */
export const buildTestMsgs = (ownCall: string, channel: string): MsgType[] => {

    const grpNum = parseInt(channel);
    const isGrp = !isNaN(grpNum);
    const isDM = (channel === "DM" || isGrp) ? 1 : 0;

    const now = Date.now();
    // minutes back from now, so the demo messages stay in chronological order at the end of the chat
    const stamp = (minutesAgo: number) => now - minutesAgo * 60000;
    const timeStr = (ts: number) => new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});

    const msg = (msgNr: number, minutesAgo: number, fromCall: string, msgTXT: string,
                 via: string, ack: number, ackCall: string): MsgType => {
        const timestamp = stamp(minutesAgo);
        return {
            timestamp,
            msgNr,
            msgTime: timeStr(timestamp),
            fromCall,
            toCall: fromCall === ownCall ? (isGrp ? channel : "OE3XYZ-2") : ownCall,
            msgTXT,
            via,
            ack,
            ackCall,
            isDM,
            isGrpMsg: isGrp ? 1 : 0,
            grpNum: isGrp ? grpNum : 0,
            notify: 0
        };
    };

    return [
        msg(990001, 9, "OE3XYZ-2", "Received message with a via path.", "OE3ABC-1 > OE3DEF-4", 0, ""),
        msg(990002, 8, "OE3XYZ-2", "Received message without via path.", " ", 0, ""),
        msg(990003, 7, ownCall, "Own message, sent but not acknowledged yet.", " ", 0, ""),
        msg(990004, 6, ownCall, "Own message, heard by a node.", " ", 1, "OE3DEF-4"),
        msg(990005, 5, ownCall, "Own message, acknowledged by the gateway.", " ", 2, "OE3ABC-1"),
        msg(990006, 4, ownCall, "Own message, acknowledged without attribution.", " ", 2, ""),
        msg(990007, 3, "OE5LNG-9", "A deliberately long received message to check the word wrapping inside the bubble and how the meta line above behaves when the text needs several lines.", "OE3ABC-1", 0, ""),
        msg(990008, 2, "OE5LNG-9", "Link check: https://icssw.org/meshcom/", " ", 0, ""),
    ];
};


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
        gas_res:0,
        symbol_table: "/",
        symbol: "#",
        neighbour_count:0,
        groups:""
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
        gas_res:0,
        symbol_table: "/",
        symbol: "#",
        neighbour_count:0,
        groups:""
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
        gas_res:0,
        symbol_table: "/",
        symbol: "#",
        neighbour_count:0,
        groups:""
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
        gas_res:0,
        symbol_table: "/",
        symbol: "#",
        neighbour_count:0,
        groups:""
    }
  ]