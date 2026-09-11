import {Store} from "pullstate";

const BLEconnStore = new Store({
    ble_connected:false,
    manual_disconnect:false,
    discoAlertRequestCount:0
})

export default BLEconnStore