import DataBaseService from "../DBservices/DataBaseService";
import LogS from "./LogService";
import { APP_SETTING_WAS_CONNECTED } from "./AppSettingKeys";

/**
 * Remember in the DB whether a connection was up that the user did not disconnect. When iOS or Android ends the app in the
 * background there is no disconnect callback, so after the cold start this is the only hint that the app should reconnect.
 */
export async function markConnected(on: boolean): Promise<void> {
    try {
        await DataBaseService.setAppSetting(APP_SETTING_WAS_CONNECTED, on ? '1' : '0');
    } catch (error) {
        LogS.log(1, "[RECONNECT] could not store the connection marker: " + error);
    }
}
