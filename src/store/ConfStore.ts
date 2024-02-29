import {Store} from "pullstate";
import { ConfType } from "../utils/AppInterfaces";

const defaultConf:ConfType = {
    callSign:"xx",
    lat:0.0,
    lon:0.0,
    alt:0.0,
    wifi_ssid:" ",
    wifi_pwd:" ",
    aprs_pri_sec:" ",
    aprs_symbol:" ",
    gps_on:false,
    gw_on:false,
    bme_on:false,
    bmp_on:false,
    display_off:false,
    track_on:false,
    button_on:false,
    bat_perc:0.0,
    bat_volt:0.0,
    hw:"",
    mod:"",
    fw_ver:"",
    tx_pwr:0,
    frequency:0.0,
    comment: "",
    onewire_on:false,
    onewire_pin:0,
    lps33_on:false,
    mesh_on:true,
    bme680_on:false,
    mcu811_on:false,
    node_utc_offset:0
}

const ConfigStore = new Store({
    config:defaultConf
});

export default ConfigStore
