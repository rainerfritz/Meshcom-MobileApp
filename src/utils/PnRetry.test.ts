import { describe, expect, it } from "vitest";
import { MsgType } from "./AppInterfaces";
import { PN_CONFIRM_TIMEOUT_MS, displayAckState, isOwnPn, pnCore, stripPnSuffix } from "./PnRetry";

const OWN = "OE1KFR-7";
const T0 = 1790768600000;

const msg = (over: Partial<MsgType> = {}): MsgType => ({
  timestamp: T0,
  msgNr: 0xa7c972d4,
  msgTime: "13:43:28",
  fromCall: OWN,
  toCall: "OE1KFR-2",
  msgTXT: "Retransmission Test old Firmware",
  via: " ",
  ack: 0,
  ackCall: "",
  isDM: 1,
  isGrpMsg: 0,
  grpNum: 0,
  notify: 1,
  ...over,
});

describe("pnCore", () => {
  it("is the same for the original and all three retry copies (field test 2026-09-30)", () => {
    const ids = [0xa7c972d4, 0xa7c976d4, 0xa7c97ad4, 0xa7c97ed4];
    expect(new Set(ids.map(pnCore)).size).toBe(1);
    // the two ids the app received as decimal msgNr
    expect(pnCore(2814997204)).toBe(pnCore(2814998228));
  });

  it("returns an unsigned value and differs for another counter or node", () => {
    expect(pnCore(0xa7c972d4)).toBeGreaterThan(0);
    expect(pnCore(0xa7c972d4)).not.toBe(pnCore(0xa7c972d5));
    expect(pnCore(0xa7c972d4)).not.toBe(pnCore(0xa7c982d4));
  });
});

describe("stripPnSuffix", () => {
  it("removes a trailing {NNN", () => {
    expect(stripPnSuffix("hi{007")).toBe("hi");
    expect(stripPnSuffix("Ja ist angekommen {694")).toBe("Ja ist angekommen ");
  });

  it("keeps a brace that is not the PN number", () => {
    expect(stripPnSuffix("a{b")).toBe("a{b");
    expect(stripPnSuffix("set {1} now")).toBe("set {1} now");
    expect(stripPnSuffix("x{123456")).toBe("x{123456");
    expect(stripPnSuffix("json {a} end{042")).toBe("json {a} end");
  });
});

describe("displayAckState", () => {
  const late = T0 + PN_CONFIRM_TIMEOUT_MS + 1;

  it("shows sent / heard inside the timeout", () => {
    expect(displayAckState(msg(), OWN, T0 + 1000)).toBe("sent");
    expect(displayAckState(msg({ ack: 1 }), OWN, T0 + PN_CONFIRM_TIMEOUT_MS)).toBe("heard");
  });

  it("shows unconfirmed for an own PN without ACK after the timeout", () => {
    expect(displayAckState(msg(), OWN, late)).toBe("unconfirmed");
    expect(displayAckState(msg({ ack: 1 }), OWN, late)).toBe("unconfirmed");
  });

  it("a late ACK always wins", () => {
    expect(displayAckState(msg({ ack: 2 }), OWN, late)).toBe("acked");
  });

  it("never marks groups, broadcasts or foreign messages unconfirmed", () => {
    expect(displayAckState(msg({ isGrpMsg: 1, grpNum: 9, toCall: "9" }), OWN, late)).toBe("sent");
    expect(displayAckState(msg({ isDM: 0, toCall: "", ack: 1 }), OWN, late)).toBe("heard");
    expect(displayAckState(msg({ fromCall: "OE1KFR-2", toCall: OWN }), OWN, late)).toBe("sent");
  });
});

describe("isOwnPn", () => {
  it("is true only for an own direct message", () => {
    expect(isOwnPn(msg(), OWN)).toBe(true);
    expect(isOwnPn(msg({ fromCall: "OE1KFR-2" }), OWN)).toBe(false);
    expect(isOwnPn(msg({ isGrpMsg: 1 }), OWN)).toBe(false);
    expect(isOwnPn(msg({ isDM: 0 }), OWN)).toBe(false);
  });
});
