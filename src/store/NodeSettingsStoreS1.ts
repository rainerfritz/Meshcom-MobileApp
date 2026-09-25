// Node Settings S1 Pullstate Store (second node settings json)

import {Store} from "pullstate";

import {NodeSettingsS1} from "../utils/AppInterfaces";

/**
 * TYP: string,
    VIA: boolean,
    VIACALL: string,
    WSPWD?: string,
    ASYM?: boolean
 */

// TYP "" = not received from the node in this connection (firmware without SN1),
// set to "SN1" when the node sends it
export const defaultNodeSettingsS1:NodeSettingsS1 = {
    TYP: "",
    VIA: false,
    VIACALL: "",
    WSPWD: "",
    ASYM: false
}

const NodeSettingsStoreS1 = new Store({
    nodeSettingsS1: defaultNodeSettingsS1
});

export default NodeSettingsStoreS1
