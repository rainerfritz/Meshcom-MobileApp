import {Store} from "pullstate";

// set by the connect page when the connected node runs a firmware older than MIN_FW_VERSION (utils/FwVersion.ts),
// the chat page shows the update hint and resets it
const UpdateFW = new Store({
    updatefw:false
})

export default UpdateFW