import { Mheard, MheardType, MH_NA } from "./AppInterfaces";

// Maps an MH json frame of the node to the app type. Every field the node left out gets a default,
// so the UI can decide per field whether there is something to show. RSSI, SNR and HM default to MH_NA,
// the distance to -1 (the node's own marker for "position unknown").
export const mapMheard = (mh: Mheard, nodeCall: string, timestamp: number, hwName: string): MheardType => ({
    mh_timestamp: timestamp,
    mh_nodecall: nodeCall,
    mh_callSign: mh.CALL,
    mh_date: mh.DATE,
    mh_time: mh.TIME,
    mh_rssi: mh.RSSI ?? MH_NA,
    mh_snr: mh.SNR ?? MH_NA,
    mh_hw: hwName,
    mh_distance: +(mh.DIST ?? -1).toFixed(2),
    mh_pl: mh.PL ?? 0,
    mh_mesh: mh.MESH ?? 0,
    mh_ncnt: mh.NCNT ?? 0,
    mh_hm: mh.HM ?? MH_NA,
    mh_gw: mh.GW ?? 0,
    mh_role: mh.ROLE ?? "",
    mh_ex: mh.EX ?? 0,
    mh_nb: mh.NB ?? 0
});
