import {Store} from "pullstate";

const BLEconnStore = new Store({
    ble_connected:false,
    manual_disconnect:false
})

export default BLEconnStore