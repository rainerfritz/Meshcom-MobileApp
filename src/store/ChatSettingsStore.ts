import { Store } from "pullstate";

// audioFlags: channel key ("ALL" | "DM" | group-number string) → true = sound on (default)
const ChatSettingsStore = new Store({
    audioFlags: {} as Record<string, boolean>
});

export default ChatSettingsStore;
