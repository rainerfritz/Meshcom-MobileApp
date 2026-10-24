// keys of the AppSettings table (DataBaseService.getAppSetting / setAppSetting)
export const APP_SETTING_CHAT_FAV_CALLS = "chatFavCallsigns"; // favourite DM callsigns, comma separated
export const APP_SETTING_AUTO_RECONNECT = "autoReconnect";   // '1' = on. Anything else, or not stored: off
export const APP_SETTING_LAST_DEVICE = "lastDeviceId";       // BLE device id of the last node we were connected to
export const APP_SETTING_WAS_CONNECTED = "wasConnected";     // '1' = a connection was up and the user did not disconnect it. Decides the reconnect after a cold start
