import {Store} from "pullstate";

// triggers when the node sends the finish message after BLE connection
const UpdateFW = new Store({
    updatefw:false
})

export default UpdateFW