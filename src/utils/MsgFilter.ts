// Filters for incoming text frames before they are stored and notified.

// Callsign a node reports while it is not configured yet
const UNSET_CALLSIGN = "XX0XXX-00";

const normCall = (call: string) => call.trim().toUpperCase();

/**
 * True for a direct message (not a group) that is neither from nor to the connected node.
 *
 * Over LoRa the firmware only passes DMs addressed to the node to the phone. A gateway however
 * also hands every server frame it relays down to LoRa to the phone unfiltered
 * (udp_functions.cpp / nrf_eth.cpp relay branch), including DMs and :ackNNN between third
 * parties. Those must not show up in the DM chat or raise a notification.
 *
 * Fail-open: with no known own callsign (info JSON not received yet, node unconfigured)
 * nothing is filtered.
 */
export function isForeignDm(fromCall: string, toCall: string, ownCall: string, isDM: number, isGrpMsg: number): boolean {
  if (isDM !== 1 || isGrpMsg !== 0) return false;

  const own = normCall(ownCall);
  if (own === "" || own === UNSET_CALLSIGN) return false;

  return normCall(fromCall) !== own && normCall(toCall) !== own;
}
