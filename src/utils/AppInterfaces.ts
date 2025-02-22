// summary of our Interfaces

// message interface
export interface MsgType {
    timestamp:number,
    msgNr:number,
    msgTime:string,
    fromCall:string,
    toCall:string,
    msgTXT:string,
    via:string,
    ack:number,
    isDM:number,
    isGrpMsg:number,
    grpNum:number,
    notify:number
}

// position interface
export interface PosType {
    timestamp:number,
    callSign:string,
    lat:number,
    lon:number,
    alt:number,
    bat:string,
    hw:string,
    pressure:number,
    temperature:number,
    humidity:number,
    qnh:number,
    comment: string,
    temp_2:number,
    co2:number,
    alt_press:number,
    gas_res:number
}

// config interface
export interface ConfType {
    callSign:string,
    lat:number,
    lon:number,
    alt:number,
    wifi_ssid:string,
    aprs_pri_sec:string,
    aprs_symbol:string,
    gps_on:boolean,
    bme_on:boolean,
    bmp_on:boolean,
    gw_on:boolean,
    display_off:boolean,
    button_on:boolean,
    track_on:boolean,
    bat_volt:number,
    bat_perc:number,
    hw:string,
    mod:string,
    fw_ver:string,
    tx_pwr:number,
    frequency:number,
    comment: string,
    onewire_on:boolean,
    onewire_pin:number,
    lps33_on:boolean,
    mesh_on:boolean,
    bme680_on:boolean,
    mcu811_on:boolean,
    node_utc_offset:number
}

// Mheard Interface
export interface MheardType {
    mh_timestamp:number,
    mh_nodecall:string,
    mh_callSign:string,
    mh_date:string,
    mh_time:string,
    mh_rssi:number,
    mh_hw:string,
    mh_snr:number,
    mh_distance:number,
    mh_pl: number,
    mh_mesh: number
}

// Reconnect flag for Background
export interface ReconType {
    recon_active:boolean
}

// gpsdata interface
// DG{"TYP":"G","LAT":48.23804855,"LON":16.31670952,"ALT":244,"SAT":0,"SFIX":false,"HDOP":0,"RATE":1200,"NEXT":1195,"DIST":0,"DIRn":0,"DIRo":0,"DATE":"2024-01-27 12:10:22"}
export interface GpsData {
    LAT: number,
    LON: number,
    ALT: number,
    SAT: number,
    SFIX: boolean,
    HDOP: number,
    RATE: number,
    NEXT: number,
    DIST: number,
    DIRn: number,
    DIRo: number,
    DATE: string
}

// wx sensor data interface
// DW{"TYP":"W","TEMP":21.42065239,"TOUT":0,"HUM":50.74215317,"PRES":1001.369995,"QNH":1030.080688,"ALT":99,"GAS":54.72800064,"CO2":0}
export interface WxData {
    TEMP: number,
    TOUT: number,
    HUM: number,
    PRES: number,
    QNH: number,
    ALT: number,
    GAS: number,
    CO2: number
}


// info msg interface
/**
 * idoc["TYP"] = "I";
            idoc["FWVER"] = fwver;
            idoc["CALL"] = meshcom_settings.node_call;
            idoc["ID"] = _GW_ID;
            idoc["HWID"] = BOARD_HARDWARE;
            idoc["MAXV"] = meshcom_settings.node_maxv;
            idoc["ATXT"] = meshcom_settings.node_atxt;
            idoc["BLE"] = (bBLElong ? "long" : "short");
            idoc["BATP"] = global_proz;
            idoc["BATV"] = global_batt/1000.0;
            idoc["GCB0"] = meshcom_settings.node_gcb[0];
            idoc["GCB1"] = meshcom_settings.node_gcb[1];
            idoc["GCB2"] = meshcom_settings.node_gcb[2];
            idoc["GCB3"] = meshcom_settings.node_gcb[3];
            idoc["GCB4"] = meshcom_settings.node_gcb[4];
            idoc["GCB5"] = meshcom_settings.node_gcb[5];
            idoc["CTRY"] = ctrycode;
            idoc["BOOST"] = bBOOSTEDGAIN;

 */
export interface InfoData {
    FWVER: string,
    CALL: string,
    ID: string,
    HWID: number,
    MAXV: number,
    ATXT: string,
    BLE: string,
    BATP: number,
    BATV: number,
    "GCB0": number,
    "GCB1": number,
    "GCB2": number,
    "GCB3": number,
    "GCB4": number,
    "GCB5": number,
    "CTRY": string,
    BOOST: boolean
}


// sensor settings interface
/**
 * sensdoc["TYP"] = "SE";
        sensdoc["BME"] = bBMEON;
        sensdoc["BMP"] = bBMPON;
        sensdoc["680"] = bBME680ON;
        sensdoc["811"] = bMCU811ON;
        sensdoc["SMALL"] = bSMALLDISPLAY;
        sensdoc["SS"] = bSOFTSERON;
        sensdoc["LPS33"] = bLPS33;
        sensdoc["OW"] = bONEWIRE;
        sensdoc["OWPIN"] = meshcom_settings.node_owgpio;
        sensdoc["USERPIN"] = meshcom_settings.node_button_pin;
        sensdoc["MHONLY"] = bMHONLY;
        sensdoc["NOALL"] = bNoMSGtoALL;
 */
export interface SensorSettings {
    TYP: string,
    BME: boolean,
    BMP: boolean,
    "680": boolean,
    "811": boolean,
    LPS33: boolean,
    OW: boolean,
    OWPIN: number,
    USERPIN: number
}

// wifi settings interface
/**
 * swdoc["TYP"] = "SW";
 * swdoc["SSID"] = meshcom_settings.node_ssid;
 * swdoc["IP"] = meshcom_settings.node_ip;
    swdoc["GW"] = meshcom_settings.node_gw;     // IP GW Address
    swdoc["AP"] = bWIFIAP;
    swdoc["DNS"] = meshcom_settings.node_dns;
    swdoc["SUB"] = meshcom_settings.node_subnet;
    swdoc["OWNIP"] = meshcom_settings.node_ownip;
    swdoc["OWNGW"] = meshcom_settings.node_owngw;
    swdoc["OWNMS"] = meshcom_settings.node_ownms;

 */
export interface WifiSettings {
    TYP: string,
    SSID: string,
    IP: string,
    GW: string,
    AP: boolean,
    DNS: string,
    SUB: string,
    OWNIP: string,
    OWNGW: string,
    OWNMS: string
}

// Node Settings interface
/**
 * nsetdoc["TYP"] = "SN";
    nsetdoc["GW"] = bGATEWAY;
    nsetdoc["WS"] = bWEBSERVER;
    nsetdoc["DISP"] =  bDisplayOff;
    nsetdoc["BTN"] = bButtonCheck;
    nsetdoc["MSH"] = bMESH;
    nsetdoc["GPS"] = bGPSON;
    nsetdoc["TRACK"] = bDisplayTrack;
    nsetdoc["UTCOF"] = meshcom_settings.node_utcoff;
    nsetdoc["TXP"] = meshcom_settings.node_power;
    nsetdoc["MQRG"] = node_qrg;
    nsetdoc["MSF"] = meshcom_settings.node_sf;
    nsetdoc["MCR"] = meshcom_settings.node_cr;
    nsetdoc["MBW"] = meshcom_settings.node_bw;
    nsetdoc["GWNPOS"] = bGATEWAY_NOPOS;
    nsetdoc["MHONLY"] = bMHONLY;
    nsetdoc["NOALL"] = bNoMSGtoALL;
 */
export interface NodeSettings {
    TYP: string,
    GW: boolean,
    WS: boolean,
    DISP: boolean,
    BTN: boolean,
    MSH: boolean,
    GPS: boolean,
    TRACK: boolean,
    UTCOF: number,
    TXP: number,
    MQRG: number,
    MSF: number,
    MCR: number,
    MBW: number,
    GWNPOS: boolean,
    MHONLY: boolean,
    NOALL: boolean
}

// APRS Settings interface 
/**
 * aprsdoc["TYP"] = "SA";
    aprsdoc["ATXT"] = meshcom_settings.node_atxt;
    aprsdoc["SYMID"] = symid;
    aprsdoc["SYMCD"] = symcd;
    aprsdoc["NAME"] = meshcom_settings.node_name;
 */
export interface AprsSettings {
    TYP: string,
    ATXT: string,
    SYMID: string,
    SYMCD: string,
    NAME: string
}

// Mheard interface
// {"TYP":"MH","CALL":"OE1KFR-2","DATE":"2023-01-01","TIME":"00:00:41","PLT":33,"HW":10,"MOD":3,"RSSI":-44,"SNR":6}
export interface Mheard {
    TYP: string,
    CALL: string,
    DATE: string,
    TIME: string,
    PLT: number,
    HW: number,
    MOD: number,
    RSSI: number,
    SNR: number,
    DIST: number,
    PL: number,
    MESH: number
}

// Config sent from Node Finish message
// {"TYP":"CONFFIN"}
export interface Conf {
    TYP: string
}

// Chat filter settings interface
export interface ChatFilterSettingsType {
    chat_filter_dm_grp: number,
    chat_filter_dm: number,
    chat_filter_grp: number,
    chat_filter_grp_num1: number,
    chat_filter_grp_num2: number,
    chat_filter_grp_num3: number,
    chat_filter_call_sign: string
}