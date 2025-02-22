import {Store} from "pullstate";
import { ChatFilterSettingsType } from "../utils/AppInterfaces";

/**
 * export interface ChatFilterSettings {
    chat_filter_dm_grp: number,
    chat_filter_grp: number,
    chat_filter_grp_num1: number,
    chat_filter_grp_num2: number,
    chat_filter_grp_num3: number,
    chat_filter_call_sign: string
}
 */

const defaultChatFilterSettings:ChatFilterSettingsType = {
    chat_filter_dm_grp:0,
    chat_filter_dm:0,
    chat_filter_grp:0,
    chat_filter_grp_num1:0,
    chat_filter_grp_num2:0,
    chat_filter_grp_num3:0,
    chat_filter_call_sign:""
}

const ChatFilterSettingsStore = new Store({
    chatFilterSettings:defaultChatFilterSettings
});

export default ChatFilterSettingsStore