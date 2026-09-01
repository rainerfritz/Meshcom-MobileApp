import { Store } from "pullstate";

// unseen message flags per channel key ("ALL" | "DM" | group-number string)
// shared between Chat.tsx (list items) and App.tsx (tab bar badge)
// unseenCounts: number of unseen messages per channel key, shown as a badge on the chat list item
const ChatUnseenStore = new Store({
    unseenFlags: {} as Record<string, boolean>,
    unseenCounts: {} as Record<string, number>
});

export default ChatUnseenStore;
