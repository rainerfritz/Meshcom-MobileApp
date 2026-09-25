// Node Settings S1 Pullstate Store (second node settings json)

import {Store} from "pullstate";

import {NodeSettingsS1} from "../utils/AppInterfaces";

/**
 * TYP: string,
    VIA: boolean,
    VIACALL: string
 */

const defaultNodeSettingsS1:NodeSettingsS1 = {
    TYP: "SN1",
    VIA: false,
    VIACALL: ""
}

const NodeSettingsStoreS1 = new Store({
    nodeSettingsS1: defaultNodeSettingsS1
});

export default NodeSettingsStoreS1
