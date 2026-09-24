import {Store} from "pullstate";

import {ViaSettings} from "../utils/AppInterfaces";

/**
    TYP: string,
    VIA: boolean,
    VIACALL: string
 */

const defaultViaSettings:ViaSettings = {
    TYP: "SV",
    VIA: false,
    VIACALL: ""
}

const ViaSettingsStore = new Store({
    viaSettings: defaultViaSettings
});

export default ViaSettingsStore
