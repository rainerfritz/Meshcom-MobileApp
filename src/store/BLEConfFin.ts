import {Store} from "pullstate";

// triggers when the node sends the finish message after BLE connection
const BleConfigFinish = new Store({
    BleConfFin:false
})

export default BleConfigFinish
