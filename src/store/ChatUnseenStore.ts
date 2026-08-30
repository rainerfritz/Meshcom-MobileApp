import { Store } from "pullstate";

// unseen message flags per channel key ("ALL" | "DM" | group-number string)
// shared between Chat.tsx (list items) and App.tsx (tab bar badge)
const ChatUnseenStore = new Store({
    unseenFlags: {} as Record<string, boolean>
});

export default ChatUnseenStore;
