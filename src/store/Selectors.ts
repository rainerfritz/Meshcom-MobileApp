import {createSelector} from 'reselect';

const getState = (state: any) => state;

// get selectors
export const getDevID = createSelector(getState, state => state.devID);

export const getMsgStore = createSelector(getState, state => state.msgArr);

export const getPosiStore = createSelector(getState, state => state.pos_arr);

export const getConfigStore = createSelector(getState, state => state.config);

export const getShouldConfStore = createSelector(getState, state => state.shouldConf);

export const getRedirChatStore = createSelector(getState, state => state.redirChat);

export const getPlatformStore = createSelector(getState, state => state.platformState);

export const getLastNotifyID = createSelector(getState, state => state.lastMsgID);

export const getAppActiveState = createSelector(getState, state => state.AppActiveState);

export const getMheards = createSelector(getState, state => state.mhArr);

export const getGpsData = createSelector(getState, state => state.gpsData);

export const getWxData = createSelector(getState, state => state.wxData);

export const getAprsCmt = createSelector(getState, state => state.aprsCmt);

export const getScanResult = createSelector(getState, state => state.scanresult);

export const getSensorSettings = createSelector(getState, state => state.sensorSettings);

export const getBLEconnStore = createSelector(getState, state => state.ble_connected);

export const getNodeInfoStore = createSelector(getState, state => state.infoData);