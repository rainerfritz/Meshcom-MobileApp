import {Store} from "pullstate";

import {AprsSettings} from "../utils/AppInterfaces";

/**
 * 
    ATXT: string,
    SYMID: string,
    SYMCD: string,
    NAME: string
 */

const defaultAprsSettings:AprsSettings = {
    TYP: "SA",
    ATXT: "",
    SYMID: "",
    SYMCD: "",
    NAME: ""
}

const AprsSettingsStore = new Store({
    aprsSettings: defaultAprsSettings
});

export default AprsSettingsStore