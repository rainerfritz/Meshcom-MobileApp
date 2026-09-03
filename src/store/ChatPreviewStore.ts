import { Store } from "pullstate";
import { MsgType } from "../utils/AppInterfaces";

// latest message from someone else (not our own callsign, not blocked/text-filtered) per channel key
// ("ALL" | "DM" | group-number string), shown as a preview line on the main chat list items
const ChatPreviewStore = new Store({
    previews: {} as Record<string, MsgType | null>
});

export default ChatPreviewStore;
