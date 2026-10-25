import { Store } from "pullstate";

// true while the Chat tab is shown and a chat (group, ALL, DM) is open instead of the chat list.
// App.tsx switches the iOS swipe back gesture of the router off then: the swipe has to lead back to the
// chat list (handled in Chat.tsx), not to the tab that was open before.
const ChatViewStore = new Store({
    inChatView: false
});

export default ChatViewStore;
