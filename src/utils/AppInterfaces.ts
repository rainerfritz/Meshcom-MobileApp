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
    wifi_pwd:string,
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
    DATE: string,
    //UTCOFF: number
    //GPSON: boolean,
    //TRACKON: boolean
}

// wx sensor data interface
// DW{"TYP":"W","TEMP":21.42065239,"TOUT":0,"HUM":50.74215317,"PRES":1001.369995,"QNH":1030.080688,"ALT":99,"GAS":54.72800064,"CO2":0}
export interface WxData {
    //BMEON: boolean,
    //BMPON: boolean,
    //BME680ON: boolean,
    //MCU811ON: boolean,
    //LPS33ON: boolean,
    //OWON: boolean,
    //OWPIN: number,
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
// DI{"TYP":"I","FWVER":"C 4.29 d","CALL":"OE1KFR-2","ID":3215539008,"HWID":10,"MAXV":4.239999771,"ATXT":"","BLE":"short","BATP":0,"BATV":1.86}
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
    "GCH": number,
    "GCB0": number,
    "GCB1": number,
    "GCB2": number,
    "GCB3": number,
    "GCB4": number,
    "CTRY": string
}


// sensor settings interface
// {"TYP":"SE","BME":false,"BMP":false,"680":true,"811":false,"LPS33":false,"OW":false,"OWPIN":4}
export interface SensorSettings {
    TYP: string,
    BME: boolean,
    BMP: boolean,
    "680": boolean,
    "811": boolean,
    LPS33: boolean,
    OW: boolean,
    OWPIN: number
}

// wifi settings interface
// {"TYP":"SW", "SSID":"string up to 30 chars?","PW":"also a long string", "IP":"192.168.1.123", "GW":"192.168.1.1", "DNS":"192.168.1.1", "SUB":"255.255.255.0"}
export interface WifiSettings {
    TYP: string,
    SSID: string,
    PW: string,
    IP: string,
    GW: string,
    DNS: string,
    SUB: string
}

// Node Settings interface
// {"TYP":"SN","GW":false,"DISP":true,"BTN":false,"MSH":true,"GPS":false,"TRACK":false,"UTCOF":28.2730,"TXP":22,"MQRG":433.175,"MSF":11,"MCR":6,"MBW":250}
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
    MBW: number
}

// APRS Settings interface 
// {"TYP":"SA","ATXT":"none","SYMID":"/","SYMCD":"#"}
export interface AprsSettings {
    TYP: string,
    ATXT: string,
    SYMID: string,
    SYMCD: string
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