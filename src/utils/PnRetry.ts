// PN (personal message / DM) retry support, firmware >= 4.35u ("variant a, XOR form").
//
// msg_id = ((node id & 0x3FFFFF) << 10) | counter(0..999). Retry copy k (1..3) of an own PN
// gets msg_id bits 10-11 XORed with k; the other 30 bits, the text and {NNN stay the same
// (firmware src/pn_retry.h). A receiving node does not fold a copy's id back, and a node with
// old firmware, the server path or a wrapped dedup ring hands every copy to the phone - so the
// same PN can arrive with up to four different msg_ids.

import { MsgType } from "./AppInterfaces";

// the 30 msg_id bits that are equal for the original and all retry copies
export const PN_CORE_MASK = 0xfffff3ff;

// copies of one PN arrive within a few minutes (4 transmissions). The shared 0..999 counter
// needs far longer to wrap, so a same-core + same-text hit inside this window is a retry copy.
export const PN_DEDUP_WINDOW_MS = 10 * 60 * 1000;

// The node gives up silently after 4 transmissions: at the earliest ~160 s after the first one,
// measured ~5:40 min in a busy mesh because every echo restarts the 40 s wait. After this time
// without an ACK an own PN is shown as "unconfirmed". A later ACK still sets it to acked.
export const PN_CONFIRM_TIMEOUT_MS = 6 * 60 * 1000;

export type AckDisplayState = "sent" | "heard" | "acked" | "unconfirmed";

export function pnCore(msgId: number): number {
  return (msgId & PN_CORE_MASK) >>> 0;
}

// remove the {NNN the node appends to an own PN, only a trailing "{" + 1-5 digits
export function stripPnSuffix(txt: string): string {
  return txt.replace(/\{\d{1,5}$/, "");
}

// true for a direct message (no group, no broadcast) sent by ownCall
export function isOwnPn(msg: MsgType, ownCall: string): boolean {
  return msg.fromCall === ownCall && msg.isDM === 1 && msg.isGrpMsg === 0;
}

/**
 * Ack state to display for a message. Derived from the stored ack + timestamp only, no timer
 * state: it stays correct across tab switches, app background, reconnects and app restarts.
 * "unconfirmed" applies to own PNs only - groups and broadcasts get no ACK from a recipient.
 */
export function displayAckState(msg: MsgType, ownCall: string, now: number): AckDisplayState {
  if (msg.ack === 2) return "acked";
  if (isOwnPn(msg, ownCall) && now - msg.timestamp > PN_CONFIRM_TIMEOUT_MS) return "unconfirmed";
  return msg.ack === 1 ? "heard" : "sent";
}
