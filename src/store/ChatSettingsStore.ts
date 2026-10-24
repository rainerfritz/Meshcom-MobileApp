import { Store } from "pullstate";
import { TextFilter } from "../DBservices/DataBaseService";

// audioFlags: channel key ("ALL" | "DM" | group-number string) → true = sound on (default)
// blockedCallsigns: channel key ("GLOBAL" | "ALL" | "DM" | group-number string) → list of blocked callsigns
// textFilters: channel key ("GLOBAL" | "ALL" | "DM" | group-number string) → list of text filters
// favCallsigns: favourite callsigns (with SSID) for the To Callsign field of Direct Messages
const ChatSettingsStore = new Store({
    audioFlags: {} as Record<string, boolean>,
    blockedCallsigns: {} as Record<string, string[]>,
    textFilters: {} as Record<string, TextFilter[]>,
    favCallsigns: [] as string[]
});

export default ChatSettingsStore;
