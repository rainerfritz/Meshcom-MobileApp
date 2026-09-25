// Node Info S1 Pullstate Store (second node info json)

import {Store} from "pullstate";

import {InfoDataS1} from "../utils/AppInterfaces";

/**
 * TYP: string,
    BDATE: string
 */

// TYP "" = not received from the node in this connection (firmware without IS1),
// set to "IS1" when the node sends it
export const defaultInfoDataS1:InfoDataS1 = {
    TYP: "",
    BDATE: ""
}

const NodeInfoStoreS1 = new Store({
    infoDataS1: defaultInfoDataS1
});

export default NodeInfoStoreS1
