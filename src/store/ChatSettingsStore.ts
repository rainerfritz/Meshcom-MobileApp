import { Store } from "pullstate";
import { TextFilter } from "../DBservices/DataBaseService";

// audioFlags: channel key ("ALL" | "DM" | group-number string) → true = sound on (default)
// blockedCallsigns: channel key ("GLOBAL" | "ALL" | "DM" | group-number string) → list of blocked callsigns
// textFilters: channel key ("GLOBAL" | "ALL" | "DM" | group-number string) → list of text filters
const ChatSettingsStore = new Store({
    audioFlags: {} as Record<string, boolean>,
    blockedCallsigns: {} as Record<string, string[]>,
    textFilters: {} as Record<string, TextFilter[]>
});

export default ChatSettingsStore;
