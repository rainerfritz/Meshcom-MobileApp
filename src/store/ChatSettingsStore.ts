import { Store } from "pullstate";

// audioFlags: channel key ("ALL" | "DM" | group-number string) → true = sound on (default)
// blockedCallsigns: channel key ("GLOBAL" | "ALL" | "DM" | group-number string) → list of blocked callsigns
const ChatSettingsStore = new Store({
    audioFlags: {} as Record<string, boolean>,
    blockedCallsigns: {} as Record<string, string[]>
});

export default ChatSettingsStore;
