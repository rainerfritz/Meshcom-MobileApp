const AD_SHORTENED_LOCAL_NAME = 0x08;
const AD_COMPLETE_LOCAL_NAME = 0x09;

/**
 * Local name of a BLE advertisement, read from the raw advertising data.
 *
 * Android fills `device.name` of a scan result from a name cache of the Bluetooth stack. It is empty for some adverts
 * (e.g. after a GATT connection was closed), although the name is part of the advertisement. This reads it from there.
 * Returns null if the advertisement carries no name.
 */
export function advLocalName(raw: DataView | undefined | null): string | null {
    if (!raw) return null;

    let shortName: string | null = null;
    let i = 0;

    // AD structures: [length, type, data...], length counts the type byte and the data. Length 0 is the zero padding
    while (i + 1 < raw.byteLength) {
        const len = raw.getUint8(i);
        if (len === 0) break;
        if (i + 1 + len > raw.byteLength) break;  // truncated structure

        const type = raw.getUint8(i + 1);
        if (type === AD_COMPLETE_LOCAL_NAME || type === AD_SHORTENED_LOCAL_NAME) {
            let name = "";
            for (let k = 0; k < len - 1; k++) {
                name += String.fromCharCode(raw.getUint8(i + 2 + k));
            }
            if (type === AD_COMPLETE_LOCAL_NAME) return name !== "" ? name : null;
            if (name !== "") shortName = name;
        }
        i += len + 1;
    }

    return shortName;
}

const MESHCOM_COMPANY_KEY = "17229";   // company id "MC" (bytes 0x4D 0x43), little endian 0x434D

/**
 * Name of a MeshCom node from its manufacturer data: company id "MC", then the BLE name ("MC-xxxx-CALLSIGN-SSID") as text.
 * The firmware sends it in the long advert mode, for names that do not fit into the advert as local name.
 * Returns null if there is no MeshCom manufacturer data.
 */
export function meshcomManufacturerName(manuf: { [key: string]: DataView } | undefined | null): string | null {
    if (!manuf) return null;

    // the key is the company id as decimal text. Look at all entries, not only the first one
    const view = manuf[MESHCOM_COMPANY_KEY];
    if (!view || view.byteLength === 0) return null;

    const bytes = new Uint8Array(view.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = view.getUint8(i);

    let text: string;
    try {
        text = new TextDecoder().decode(bytes);
    } catch {
        text = String.fromCharCode(...Array.from(bytes));
    }

    // zero padding is no part of the name
    text = text.replace(/\0+$/, "").trim();
    return text !== "" ? text : null;
}
