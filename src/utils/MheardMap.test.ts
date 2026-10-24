import { describe, it, expect } from "vitest";
import { mapMheard } from "./MheardMap";
import { Mheard, MH_NA } from "./AppInterfaces";

const base: Mheard = { TYP: "MH", CALL: "OE1ABC-1", DATE: "2026-10-24", TIME: "10:00:00", HW: 3 };

describe("mapMheard", () => {
  it("maps all fields of a full frame", () => {
    const m = mapMheard({ ...base, RSSI: -91, SNR: -1, DIST: 1.84, PL: 3, MESH: 1, NCNT: 7, HM: -3, ROLE: "N", EX: 1, NB: 4, GW: 1 }, "OE1KFR-1", 5, "T-Beam");
    expect(m).toMatchObject({ mh_rssi: -91, mh_snr: -1, mh_distance: 1.84, mh_ncnt: 7, mh_hm: -3, mh_role: "N", mh_ex: 1, mh_nb: 4, mh_gw: 1, mh_hw: "T-Beam" });
  });

  it("uses defaults for fields the node did not send", () => {
    const m = mapMheard(base, "OE1KFR-1", 5, "T-Beam");
    expect(m).toMatchObject({ mh_rssi: MH_NA, mh_snr: MH_NA, mh_hm: MH_NA, mh_distance: -1, mh_pl: 0, mh_mesh: 0, mh_ncnt: 0, mh_gw: 0, mh_role: "", mh_ex: 0, mh_nb: 0 });
  });

  it("keeps real zero values", () => {
    const m = mapMheard({ ...base, RSSI: 0, SNR: 0, HM: 0 }, "OE1KFR-1", 5, "x");
    expect(m).toMatchObject({ mh_rssi: 0, mh_snr: 0, mh_hm: 0 });
  });
});
