import {
    SQLiteDBConnection,
    SQLiteConnection,
    CapacitorSQLite,
  } from "@capacitor-community/sqlite";

import { MsgType, PosType } from "../utils/AppInterfaces";
import PosiStore from "../store/PosiStore";
import MsgStore from "../store/MsgStore";
import ChatPreviewStore from "../store/ChatPreviewStore";
import { format, sub } from "date-fns";
import LogS from "../utils/LogService";
import ConfigObject from "../utils/ConfigObject";

// a single text filter entry: matches a message's text either exactly or as a substring
export interface TextFilter {
    id: string;
    text: string;
    matchType: 'exact' | 'contains';
}


class DatabaseService {

    static connection: SQLiteConnection | null = null;
    static db: SQLiteDBConnection | null = null;
    static dbName = 'meshcom.db';
    static isInit = false;
    static MAX_AGE_TXT_MSG = 3; // 3 days
    static MAX_AGE_POS = 3; // 3 days
    static cached_positions: PosType[] = [];
    private static chatFilterSetting: string = 'ALL';
    

    static async initializeDatabase() {
        LogS.log(0, 'Initializing Database');
        try {
            // check the db connection or build one
            await DatabaseService.checkDbConn();
            
            if (DatabaseService.db) {
                try {
                    LogS.log(0, 'DB Name: ' + DatabaseService.db?.getConnectionDBName());
                    LogS.log(0, 'Opening Database: ' + DatabaseService.dbName);
                    await DatabaseService.db.open();
                    const res = await DatabaseService.db.isDBOpen();
                    if (res.result) {
                        LogS.log(0, 'Database is open');
                    } else {
                        LogS.log(1, 'Error opening database');
                    }
                } catch (error) {
                    LogS.log(1, 'Error opening database:' + error);
                }
                
            } else {
                LogS.log(1, 'Error Database could not be opened');
            }

            // TextMessages table
            if (DatabaseService.db) {
                await DatabaseService.db.execute(`
                    CREATE TABLE IF NOT EXISTS TextMessages (
                        id INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                        msgNr INTEGER,
                        msgTime TEXT,
                        fromCall TEXT,
                        toCall TEXT,
                        msgTXT TEXT,
                        via TEXT,
                        ack INTEGER,
                        isDM INTEGER,
                        isGrpMsg INTEGER,
                        grpNum INTEGER,
                        notify INTEGER
                    )
                `).catch((err) => {
                    LogS.log(1, 'Error creating TextMessages table:' + err);
                });
            }

            // check if we have isGrpMsg and grpNum columns in the TextMessages table
            if (DatabaseService.db) {
                await DatabaseService.db.query(`SELECT isGrpMsg FROM TextMessages;`).catch(async (err) => {
                    LogS.log(1, 'Checking/adding isGrpMsg, grpNum in TextMessages table:' + err);
                    // add isGrpMsg and grpNum columns
                    await DatabaseService.db?.execute(`ALTER TABLE TextMessages ADD COLUMN isGrpMsg INTEGER DEFAULT 0;`);
                    await DatabaseService.db?.execute(`ALTER TABLE TextMessages ADD COLUMN grpNum INTEGER DEFAULT 0;`);
                });
            }

            // Positions table
            if (DatabaseService.db) {
                await DatabaseService.db.execute(`
                    CREATE TABLE IF NOT EXISTS Positions (
                        id INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                        callSign TEXT,
                        lat REAL,
                        lon REAL,
                        alt REAL,
                        bat TEXT,
                        hw TEXT,
                        pressure REAL,
                        temperature REAL,
                        humidity REAL,
                        qnh REAL,
                        comment TEXT,
                        temp_2 REAL,
                        co2 REAL,
                        alt_press REAL,
                        gas_res REAL,
                        neighbour_count INTEGER,
                        groups TEXT
                    )
                `).catch((err) => {
                    LogS.log(1, 'Error creating Positions table:' + err);
                });
            }

            // check if we have the neighbour_count and groups columns in the Positions table. If not add them
            if (DatabaseService.db) {
                await DatabaseService.db.query(`SELECT neighbour_count FROM Positions;`).catch(async (err) => {
                    LogS.log(1, 'Checking/adding neighbour_count, groups in Positions table:' + err);
                    // add neighbour_count and groups columns
                    await DatabaseService.db?.execute(`ALTER TABLE Positions ADD COLUMN neighbour_count INTEGER DEFAULT 0;`);
                    await DatabaseService.db?.execute(`ALTER TABLE Positions ADD COLUMN groups TEXT DEFAULT '';`);
                });
            }

            if (DatabaseService.db) {
                console.log('Creating reconState table');
                await DatabaseService.db.execute(`CREATE TABLE IF NOT EXISTS reconState (
                    id INTEGER PRIMARY KEY NOT NULL,
                    reconStateVal INTEGER NOT NULL,
                    devID TEXT
                );`).catch((err) => {
                        LogS.log(1, 'Error creating reconState table:' + err);
                });
                
                const res = await DatabaseService.db?.query('SELECT * FROM reconState');
                console.log('reconState:' + res?.values);
                if (res.values === undefined || res.values.length === 0) {
                    console.log('reconState table is empty, adding default value');
                    await DatabaseService.db?.execute('INSERT INTO reconState (id,reconStateVal,devID) VALUES (0,0,"");');

                    const res = await DatabaseService.db?.query('SELECT * FROM reconState');
                    console.log('reconState after insert:' + res?.values);
                }

            } else {
                LogS.log(1, 'Error creating recon table. Database connection not open.');
            }

            if (DatabaseService.db) {
                console.log('Creating ble_pins table');
                await DatabaseService.db.execute(`CREATE TABLE IF NOT EXISTS ble_pins (
                    device_name TEXT PRIMARY KEY NOT NULL,
                    pin TEXT NOT NULL
                );`).catch((err) => {
                    LogS.log(1, 'Error creating ble_pins table:' + err);
                });
            } else {
                LogS.log(1, 'Error creating ble_pins table. Database connection not open.');
            }

            if (DatabaseService.db) {
                await DatabaseService.db.execute(`
                    CREATE TABLE IF NOT EXISTS ChatSettings (
                        channel TEXT PRIMARY KEY NOT NULL,
                        audioEnabled INTEGER NOT NULL DEFAULT 1
                    )
                `).catch((err) => {
                    LogS.log(1, 'Error creating ChatSettings table:' + err);
                });
            }

            // check if we have the blockedCallsigns column in ChatSettings. If not add it (comma-separated callsigns; channel 'GLOBAL' is reserved for app-wide blocks)
            if (DatabaseService.db) {
                await DatabaseService.db.query(`SELECT blockedCallsigns FROM ChatSettings;`).catch(async (err) => {
                    LogS.log(1, 'Checking/adding blockedCallsigns in ChatSettings table:' + err);
                    await DatabaseService.db?.execute(`ALTER TABLE ChatSettings ADD COLUMN blockedCallsigns TEXT DEFAULT '';`);
                });
                // load the blocked-callsigns cache used for live message filtering
                await DatabaseService.loadBlockedCallsignsCache();
            }

            // check if we have the textFilters column in ChatSettings. If not add it (JSON array of TextFilter, UTF-8 safe)
            if (DatabaseService.db) {
                await DatabaseService.db.query(`SELECT textFilters FROM ChatSettings;`).catch(async (err) => {
                    LogS.log(1, 'Checking/adding textFilters in ChatSettings table:' + err);
                    await DatabaseService.db?.execute(`ALTER TABLE ChatSettings ADD COLUMN textFilters TEXT DEFAULT '[]';`);
                });
                // load the text-filter cache used for live message filtering
                await DatabaseService.loadTextFilterCache();
            }


            // housekeeping
            if (DatabaseService.db) {
                await DatabaseService.housekeeping();

                // update the store with txt messages
                const txtMsgs = await DatabaseService.getTextMessages();
                const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);

                if (txtMsgs.length > 0) {
                    //apply filters, updates the store then
                    DatabaseService.applyFilters(escTxtMsgs);
                }

                // update the store with positions
                const positions = await DatabaseService.getPositions();
                if (positions.length > 0) {
                    PosiStore.update(s => {
                        s.posArr = positions;
                    });
                }

                DatabaseService.isInit = true;
            }
        } catch (error) {
            LogS.log(1, 'Error initializing database:' + error);
            DatabaseService.isInit = false;
        }
    }

    // get all text messages from the TextMessages table
    static async getTextMessages() {
        if (DatabaseService.db) {
            console.log('DB Getting text messages');
            try {
                const res = await DatabaseService.db.query('SELECT * FROM TextMessages ORDER BY timestamp ASC;');
                if (res.values) {
                    //console.log('TextMessages:', res.values);
                    // print all the messages
                    /*res.values.forEach((msg: MsgType) => {
                        console.log('MsgNr:', msg.msgNr, 'MsgTimestamp:', msg.timestamp, 'MsgTime:', msg.msgTime, 'From:', msg.fromCall, 'To:', msg.toCall, 'Msg:', msg.msgTXT, 'Via:', msg.via, 'Ack:', msg.ack, 'isDM:', msg.isDM, 'Notify:', msg.notify);
                    });*/
                    return res.values;
                }
            } catch (error) {
                LogS.log(1, 'Error getting text messages:' + error);
            }
        } else {
            LogS.log(1, 'Error getting text messages. Database not open.');
        }
        return [];
    }

    // writeTxtMsg to the TextMessages table
    static async writeTxtMsg(msg: MsgType, isInitMsg: boolean) {
        msg.msgTXT = DatabaseService.escapeQuotes(msg.msgTXT);

        if (DatabaseService.db) {
            // check first if we have that message alredy in the database
            const res = await DatabaseService.db.query(`SELECT * FROM TextMessages WHERE msgNr = ${msg.msgNr} AND fromCall = '${msg.fromCall}' AND msgTXT = '${msg.msgTXT}'`);
            if (res.values && res.values.length > 0) {
                console.log('DB Writing Txt Msg: Message already in database');
                return;
            }

            console.log('DB Writing text message:' + msg.msgTXT);

            try {
                const id = Date.now();
                const query_str = `INSERT INTO TextMessages (id,timestamp, msgNr, msgTime, fromCall, toCall, msgTXT, via, ack, isDM, isGrpMsg, grpNum, notify) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
                const values = [id, msg.timestamp, msg.msgNr, msg.msgTime, msg.fromCall, msg.toCall, msg.msgTXT, msg.via, msg.ack, msg.isDM, msg.isGrpMsg, msg.grpNum, msg.notify];
                const ret = await DatabaseService.db.run(query_str, values);
                console.log('DB writeTxtMsg ret:' + ret.changes?.values);
                // read back all messages
                const txtMsgs = await DatabaseService.getTextMessages();
                const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);
                //apply filters, updates the store then
                DatabaseService.applyFilters(escTxtMsgs);
                // if this is not during init load from node connection, we need to mark the segment buttons in chat page
                // skip the marker if the message is blocked/text-filtered (global or channel-specific), since it won't show in chat either
                const currentCallsign = ConfigObject.getConf().CALL;
                const isFiltered = msg.fromCall !== currentCallsign &&
                    (DatabaseService.isBlocked(msg.fromCall, msg.isDM === 1 && msg.isGrpMsg === 1 ? msg.grpNum.toString() : (msg.isDM === 1 ? "DM" : "ALL")) ||
                     DatabaseService.isTextFiltered(msg.msgTXT, msg.isDM === 1 && msg.isGrpMsg === 1 ? msg.grpNum.toString() : (msg.isDM === 1 ? "DM" : "ALL")));
                if (isInitMsg && !isFiltered) {
                    if (msg.isDM === 0 && msg.isGrpMsg === 0) {
                        ConfigObject.addInitChatSegmentMarker("ALL");
                    } else if (msg.isDM === 1 && msg.isGrpMsg === 0) {
                        ConfigObject.addInitChatSegmentMarker("DM");
                    } else if (msg.isDM === 1 && msg.isGrpMsg === 1) {
                        ConfigObject.addInitChatSegmentMarker(msg.grpNum.toString());
                    }
                }
            } catch (error) {
                LogS.log(1, 'Error writing text message:' + error);
            }
        } else {
            LogS.log(1, 'Error writing text message. Database not open.');
        }
    }

    // escape single and double quotes in a single message
    static escapeQuotes(str: string) {
        return str.replace(/'/g, "''").replace(/"/g, '""');
    }

    // replace single and double quotes in the whole array of messages for diplaying
    static escapeQuotesInArr(arr: MsgType[]) {
        for (let i = 0; i < arr.length; i++) {
            arr[i].msgTXT = arr[i].msgTXT.replace(/''/g, "'").replace(/""/g, '"');
        }
        return arr;
    }

    // Acknowledge Text Message
    static async ackTxtMsg(msgNr: number, ack_type: number) {
        if (DatabaseService.db) {
            console.log('DB Acknowledging text message:' + msgNr);
            try {
                // get message(s) with msgNr
                const res = await DatabaseService.db.query(`SELECT * FROM TextMessages WHERE msgNr = ${msgNr}`);
                if (res.values) {
                    if(res.values.length > 1) {
                        LogS.log(1, 'More than one message with the same msgNr!');
                    }
                    for (let i = 0; i < res.values.length; i++) {
                        const msg: MsgType = res.values[i];
                        if (msg.ack !== 2) {
                            console.log("Setting Ack for MSGID: " + msgNr);
                            console.log("Ack Type: " + ack_type);
                            console.log("Ack Msg Nr. in DB: " + msg.msgNr);

                            if (ack_type === 0x01) {
                                // msg came from GW
                                msg.ack = 2;
                            }
                            if (ack_type === 0x00) {
                                // msg came from another node 
                                msg.ack = 1;
                            }
                            if (ack_type === 0x02) {
                                // msg came from DM Node. Should 0 and 1 instead of 0 and 2
                                msg.ack = 2;
                            }

                            // update in DB
                            const query_str = `UPDATE TextMessages SET ack = ${msg.ack} WHERE msgNr = ${msgNr}`;
                            const ret = await DatabaseService.db.execute(query_str);
                            console.log('DB ackTxtMsg ret:', ret.changes);
                            // read back all messages
                            const txtMsgs = await DatabaseService.getTextMessages();
                            const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);
                            //console.log("Last Message in DB:", escTxtMsgs[escTxtMsgs.length - 1]);
                            if (txtMsgs.length > 0) {
                                //apply filters, updates the store then
                                DatabaseService.applyFilters(escTxtMsgs);
                            }
                        }
                    }
                }
            } catch (error) {
                LogS.log(1, 'Error acknowledging text message:' + error);
            }
        } else {
            LogS.log(1, 'Error acknowledging text message. Database not open.');
        }
    }

    // get all positions from the Positions table
    static async getPositions() {
        if (DatabaseService.db) {
            console.log('DB Getting positions');
            try {
                const res = await DatabaseService.db.query('SELECT * FROM Positions;');
                if (res.values) {
                    //console.log('Positions:', res.values);
                    return res.values;
                }
            } catch (error) {
                LogS.log(1, 'Error getting positions:' + error);
            }
        } else {
            LogS.log(1, 'Error getting positions. Database not open.');
        }
        return [];
    }

    // get a single position
    static async getPos(callSign: string) {
        if (DatabaseService.db) {
            console.log('DB Getting position for:', callSign);
            try {
                const res = await DatabaseService.db.query(`SELECT * FROM Positions WHERE callSign = '${callSign}'`);
                if (res.values) {
                    //console.log('Position:', res.values);
                    return res.values[0];
                }
            } catch (error) {
                LogS.log(1, 'Error getting position:' + error);
            }
        } else {
            LogS.log(1, 'Error getting position. Database not open.');
        }
        return null;
    }

    // writePos to the Positions table
    static async writePos(pos: PosType) {
        // check first if we have that position alredy in the database (same callSign) and update it
        const res = await DatabaseService.db?.query(`SELECT * FROM Positions WHERE callSign = '${pos.callSign}'`);
        if (res?.values && res.values.length > 0) {
            console.log('DB Writing Pos: Updating position');
            await DatabaseService.updatePos(pos);
            return;
        }
        if (DatabaseService.db) {
            console.log('DB Writing position:', pos.callSign);
            try {
                const id = Date.now();
                const query_str = `INSERT INTO positions (id,timestamp, callSign, lat, lon, alt, bat, hw, pressure, temperature, humidity, qnh, comment, temp_2, co2, alt_press, gas_res, neighbour_count, groups) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
                const values = [id, pos.timestamp, pos.callSign, pos.lat, pos.lon, pos.alt, pos.bat, pos.hw, pos.pressure, pos.temperature, pos.humidity, pos.qnh, pos.comment, pos.temp_2, pos.co2, pos.alt_press, pos.gas_res, pos.neighbour_count, pos.groups];
                const ret = await DatabaseService.db.run(query_str, values);
                console.log('DB writePos ret:', ret.changes?.values);
                // update the store
                PosiStore.update(s => {
                    s.posArr.push(pos);
                });
            } catch (error) {
                LogS.log(1, 'Error writing position:' + error);
            }
        } else {
            LogS.log(1, 'Error writing position. Database connection not open.');
        }
    }


    // update a position in the Positions table from a specific callsign
    static async updatePos(pos: PosType) {
        if (DatabaseService.db) {
            console.log('DB Updating position:', pos.callSign);
            try {
                const query_str = `UPDATE positions SET timestamp = ?, lat = ?, lon = ?, alt = ?, bat = ?, hw = ?, pressure = ?, temperature = ?, humidity = ?, qnh = ?, comment = ?, temp_2 = ?, co2 = ?, alt_press = ?, gas_res = ?, neighbour_count = ?, groups = ? WHERE callSign = ?`;
                const values = [pos.timestamp, pos.lat, pos.lon, pos.alt, pos.bat, pos.hw, pos.pressure, pos.temperature, pos.humidity, pos.qnh, pos.comment, pos.temp_2, pos.co2, pos.alt_press, pos.gas_res, pos.neighbour_count, pos.groups, pos.callSign];
                const ret = await DatabaseService.db.run(query_str, values);
                console.log('DB updatePos ret:', ret.changes?.values);
                // read back all positions
                const positions:PosType[] = await DatabaseService.getPositions();
                if (positions.length > 0) {
                    PosiStore.update(s => {
                        s.posArr = positions;
                    });
                }
            } catch (error) {
                LogS.log(1, 'Error updating position:' + error);
            }
        } else {
            LogS.log(1, 'Error updating position. Database connection not open.');
        }
    }


    // check if we have db connection and db is open
    static async checkDbConn() {
        // do we have a sqlite connection object?
        if(DatabaseService.connection === null) {
            LogS.log(0, 'DB - No connection object. Crating a new one');
            const sqlite = new SQLiteConnection(CapacitorSQLite);
            DatabaseService.connection = sqlite as SQLiteConnection; // Cast to SQLiteConnection
        }
        // check if we have connection
        const retCC = (await DatabaseService.connection.checkConnectionsConsistency()).result;
        const conn = (await DatabaseService.connection?.isConnection(DatabaseService.dbName, false)).result;
        if (conn && retCC) {
            LogS.log(0, 'DB - getting SQLite Connection:' + conn);
            DatabaseService.db = await DatabaseService.connection.retrieveConnection(DatabaseService.dbName, false);
        } else {
            LogS.log(0, 'DB - Database connection not open');
            // create a new connection
            try {
                LogS.log(0, 'DB - Creating new connection');
                DatabaseService.db = await DatabaseService.connection.createConnection(DatabaseService.dbName, false, 'no-encryption', 1, false);
            } catch (error) {
                LogS.log(1, 'Error creating new connection:' + error);
                DatabaseService.isInit = false;
            }
        }
        // check if db is open
        if (DatabaseService.db) {
            const res = await DatabaseService.db.isDBOpen();
            if (res.result) {
                LogS.log(0, 'DB - Database is open');
                DatabaseService.isInit = true;
            } else {
                LogS.log(1, 'Database is not open');
                // open the database
                try {
                    LogS.log(0, 'DB - Opening database');
                    await DatabaseService.db.open();
                    // check if db is open
                    const res = await DatabaseService.db.isDBOpen();
                    if (res.result) {
                        LogS.log(0, 'Database is open');
                        DatabaseService.isInit = true;
                    } else {
                        LogS.log(1, 'Database is not open');
                        DatabaseService.isInit = false;
                    }
                } catch (error) {
                    LogS.log(1, 'Error opening database:' + error);
                    DatabaseService.isInit = false;
                }
            }
        } else {
            LogS.log(1, 'Error Database could not be opened');
            DatabaseService.isInit = false;
        }
    }

     
    // close the database connection
    static async closeConnection() {
        if (DatabaseService.db) {
            LogS.log(0, 'DB Closing database');
            try {
                await DatabaseService.db.close();
                await DatabaseService.connection?.closeConnection(this.dbName, false);
                DatabaseService.isInit = false;
            } catch (error) {
                LogS.log(1, 'Error closing database:' + error);
            }
        }
    }

    // return reconStateVal
    static async getReconState() {
        console.log('SQLite Connection:', DatabaseService.connection);
        console.log('SQLite DB:', DatabaseService.db);

        if (DatabaseService.db) {
            console.log('DB Getting reconState');
            try {
                const res = await DatabaseService.db.query('SELECT * FROM reconState WHERE id = 0;');
                if (res.values) {
                    console.log('reconStateVal:', res.values[0].reconStateVal);
                    return res.values[0].reconStateVal;
                }
            } catch (error) {
                console.error('Error getting reconState:', error);
            }
        } else {
            console.error('Error getting reconState. Database not open.');
            return -1;
        }
        
    }

    // get stored BLE PIN for a device (keyed by device name / callsign)
    static async getBlePin(deviceName: string): Promise<string | null> {
        console.log("Getting BLE PIN for device:", deviceName);
        if (DatabaseService.db) {
            try {
                const res = await DatabaseService.db.query(
                    `SELECT pin FROM ble_pins WHERE device_name = '${deviceName}';`
                );
                if (res.values && res.values.length > 0) {
                    return res.values[0].pin as string;
                }
                return null;
            } catch (error) {
                console.error('Error getting BLE PIN:', error);
                return null;
            }
        } else {
            console.error('Error getting BLE PIN. Database not open.');
            return null;
        }
    }

    // store BLE PIN for a device (upsert)
    static async setBlePin(deviceName: string, pin: string): Promise<void> {
        console.log("Storing BLE PIN for device:", deviceName);
        if (DatabaseService.db) {
            try {
                await DatabaseService.db.execute(
                    `INSERT INTO ble_pins (device_name, pin) VALUES ('${deviceName}', '${pin}')
                     ON CONFLICT(device_name) DO UPDATE SET pin = '${pin}';`
                );
                console.log('BLE PIN stored for:', deviceName);
            } catch (error) {
                console.error('Error storing BLE PIN:', error);
            }
        } else {
            console.error('Error storing BLE PIN. Database not open.');
        }
    }

    // clear stored BLE PIN for a device
    static async clearBlePin(deviceName: string): Promise<void> {
        console.log("Clearing BLE PIN for device:", deviceName);
        if (DatabaseService.db) {
            try {
                await DatabaseService.db.execute(
                    `DELETE FROM ble_pins WHERE device_name = '${deviceName}';`
                );
                console.log('BLE PIN cleared for:', deviceName);
            } catch (error) {
                console.error('Error clearing BLE PIN:', error);
            }
        } else {
            console.error('Error clearing BLE PIN. Database not open.');
        }
    }

    // clear all stored BLE PINs
    static async clearAllBlePins(): Promise<void> {
        if (DatabaseService.db) {
            try {
                await DatabaseService.db.execute(`DELETE FROM ble_pins;`);
                console.log('All BLE PINs cleared');
            } catch (error) {
                console.error('Error clearing all BLE PINs:', error);
            }
        } else {
            console.error('Error clearing all BLE PINs. Database not open.');
        }
    }   

    // set reconStateVal
    static async setReconState(val: number, devID_: string) {
        if (DatabaseService.db) {
            console.log('DB Setting reconState:', val + ' ' + devID_);
            try {
                await DatabaseService.db.execute(`UPDATE reconState SET reconStateVal = ${val}, devID = "${devID_}" WHERE id = 0;`);
                // print the new reconStateVal
                const res = await DatabaseService.db.query('SELECT * FROM reconState WHERE id = 0;');
                if (res.values) {
                    console.log('New reconStateVal:', res.values[0].reconStateVal);
                }
            } catch (error) {
                console.error('Error setting reconState:', error);
            }
        } else {
            console.error('Error setting reconState. Database not open.');
        }
    }

    // clear the TextMessages table
    static async clearTextMessages() {
        if (DatabaseService.db) {
            console.log('DB Clearing TextMessages');
            try {
                await DatabaseService.db.execute('DELETE FROM TextMessages;');
                MsgStore.update(s => {
                    s.msgArr = [];
                });
            } catch (error) {
                console.error('Error clearing TextMessages:', error);
            }
        } else {
            console.error('Error clearing TextMessages. Database not open.');
        }
    }

    // clear the Positions table
    static async clearPositions() {
        if (DatabaseService.db) {
            console.log('DB Clearing Positions');
            try {
                await DatabaseService.db.execute('DELETE FROM Positions;');
                // update the store
                PosiStore.update(s => {
                    s.posArr = [];
                });
            } catch (error) {
                console.error('Error clearing Positions:', error);
            }
        } else {
            console.error('Error clearing Positions. Database not open.');
        }
    }

    // Housekeeping function to remove old messages from the TextMessages and Positions table
    // Both have the timestamp field
    static async housekeeping() {
        LogS.log(0, 'DB Housekeeping');
        // get current date
        const today = new Date();
        const max_timestamp_txt = sub(today, { days: DatabaseService.MAX_AGE_TXT_MSG });
        const max_timestamp_pos = sub(today, { days: DatabaseService.MAX_AGE_POS });
        const max_timestamp_unix_txt =  max_timestamp_txt.getTime();
        const max_timestamp_unix_pos =  max_timestamp_pos.getTime();
        console.log('Max timestamp txt:', max_timestamp_unix_txt);
        console.log('Max timestamp txt:', format(max_timestamp_txt, 'yyyy-MM-dd HH:mm:ss'));
        console.log('Max timestamp pos:', format(max_timestamp_pos, 'yyyy-MM-dd HH:mm:ss'));

        // delete all messages older than max_timestamp_txt
        if (DatabaseService.db) {
            const sql_str = `DELETE FROM TextMessages WHERE timestamp < ${max_timestamp_unix_txt};`;
            const ret_txt = await DatabaseService.db?.execute(sql_str);
            console.log('DB housekeeping TextMessages ret:', ret_txt?.changes?.values);
            // delete all positions older than max_timestamp_pos
            const sql_str_pos = `DELETE FROM Positions WHERE timestamp < ${max_timestamp_unix_pos};`;
            const ret_pos = await DatabaseService.db?.execute(sql_str_pos);
            console.log('DB housekeeping Positions ret:', ret_pos?.changes?.values);
        } else {
            LogS.log(1, 'Error housekeeping. Database not open.');
        }
    }

    // FILTERING
    // set the filterstring based on the seqgment button selection in the Chat page
    static async setChatFilters(filterStr: string) {

        this.chatFilterSetting = filterStr;
        console.log('DB Setting Chat Filters to:', filterStr);
        try {
            const msgs = await this.getTextMessages();
            this.applyFilters(msgs);
            // write the settings to the ChatFilterTable table
            //await this.writeChatFilterSettings();
        } catch (error) {
            LogS.log(1, 'DB Error setting DM/Grp filter:' + error);
        }
    }


    // function to apply the filters and return the filtered messages. Also show always own send messages
    static applyFilters(msgs: MsgType[]) {
        let filtered_msgs:MsgType[] = [];
        const currentCallsign = ConfigObject.getConf().CALL;

        // apply the chat filter string
        if (this.chatFilterSetting === 'ALL') {
            filtered_msgs = msgs.filter((msg) => {
                return (msg.fromCall === currentCallsign && msg.isDM !== 1 && msg.isGrpMsg !== 1) || (msg.isDM !== 1 && msg.isGrpMsg !== 1);
            });
        } else if (this.chatFilterSetting === 'DM') {
            filtered_msgs = msgs.filter((msg) => {
                return (msg.isDM === 1 && msg.isGrpMsg !== 1) || (msg.fromCall === currentCallsign && msg.isDM === 1 && msg.isGrpMsg !== 1);
            });
        } else {
            // check if it is a group number
            const _grpNum = parseInt(this.chatFilterSetting);
            if (!isNaN(_grpNum)) {
                filtered_msgs = msgs.filter((msg) => {
                    return msg.isGrpMsg === 1 && msg.grpNum === _grpNum || (msg.fromCall === currentCallsign && msg.isGrpMsg === 1 && msg.grpNum === _grpNum);
                });
            }
        }
        
        // exclude callsigns blocked globally or for this channel (never block our own messages)
        filtered_msgs = filtered_msgs.filter((msg) => {
            if (msg.fromCall === currentCallsign) return true;
            if (DatabaseService.isBlocked(msg.fromCall, this.chatFilterSetting)) return false;
            return !DatabaseService.isTextFiltered(msg.msgTXT, this.chatFilterSetting);
        });

        // update the store
        MsgStore.update(s => {
            s.msgArr = filtered_msgs;
        });

        // refresh the "last message" previews shown on the main chat list, independent of the active filter
        DatabaseService.updateChatPreviews(msgs, currentCallsign);
    }

    // recompute the latest message from someone else (not blocked/text-filtered) for every channel key
    // ("ALL" | "DM" | group-number string), used as the preview line on the main chat list items
    static updateChatPreviews(msgs: MsgType[], currentCallsign: string) {
        const previews: Record<string, MsgType | null> = {};

        for (const msg of msgs) {
            if (msg.fromCall === currentCallsign) continue;

            const channelKey = msg.isGrpMsg === 1 ? msg.grpNum.toString() : (msg.isDM === 1 ? 'DM' : 'ALL');

            if (DatabaseService.isBlocked(msg.fromCall, channelKey)) continue;
            if (DatabaseService.isTextFiltered(msg.msgTXT, channelKey)) continue;

            // msgs is ordered by timestamp ASC, so a later match always overwrites the previous one
            previews[channelKey] = msg;
        }

        ChatPreviewStore.update(s => {
            s.previews = previews;
        });
    }

    // get the current chat filter setting string
    static getChatFilterSetting() {
        return this.chatFilterSetting;
    }

    // load all ChatSettings rows as a channel→audioEnabled map, plus the blocked-callsigns and text-filter lists per channel ('GLOBAL' = app-wide)
    static async getChatSettings(): Promise<{ audioFlags: Record<string, boolean>; blockedCallsigns: Record<string, string[]>; textFilters: Record<string, TextFilter[]> }> {
        const audioFlags: Record<string, boolean> = {};
        const blockedCallsigns: Record<string, string[]> = {};
        const textFilters: Record<string, TextFilter[]> = {};
        if (DatabaseService.db) {
            try {
                const res = await DatabaseService.db.query('SELECT * FROM ChatSettings;');
                if (res.values) {
                    res.values.forEach((row: any) => {
                        audioFlags[row.channel] = row.audioEnabled === 1;
                        blockedCallsigns[row.channel] = row.blockedCallsigns ? row.blockedCallsigns.split(',').filter((c: string) => c.length > 0) : [];
                        textFilters[row.channel] = DatabaseService.parseTextFilters(row.textFilters);
                    });
                }
            } catch (error) {
                LogS.log(1, 'Error getting chat settings:' + error);
            }
        }
        return { audioFlags, blockedCallsigns, textFilters };
    }

    // persist audio-alert on/off for a channel (upsert)
    static async setChatAudio(channel: string, enabled: boolean): Promise<void> {
        if (DatabaseService.db) {
            try {
                await DatabaseService.db.execute(
                    `INSERT INTO ChatSettings (channel, audioEnabled) VALUES ('${channel}', ${enabled ? 1 : 0})
                     ON CONFLICT(channel) DO UPDATE SET audioEnabled = ${enabled ? 1 : 0};`
                );
            } catch (error) {
                LogS.log(1, 'Error setting chat audio:' + error);
            }
        }
    }

    // MESSAGE FILTERS - block callsigns either globally ('GLOBAL') or for one chat channel ('ALL'/'DM'/group number)
    private static blockedCache: Record<string, string[]> = {};

    // (re)load the blocked-callsigns cache from the ChatSettings table
    static async loadBlockedCallsignsCache(): Promise<void> {
        DatabaseService.blockedCache = {};
        if (DatabaseService.db) {
            try {
                const res = await DatabaseService.db.query('SELECT channel, blockedCallsigns FROM ChatSettings;');
                if (res.values) {
                    res.values.forEach((row: any) => {
                        DatabaseService.blockedCache[row.channel] = row.blockedCallsigns ? row.blockedCallsigns.split(',').filter((c: string) => c.length > 0) : [];
                    });
                }
            } catch (error) {
                LogS.log(1, 'Error loading blocked callsigns cache:' + error);
            }
        }
    }

    // check whether a callsign is blocked globally or for a specific channel
    static isBlocked(fromCall: string, channelKey: string): boolean {
        const global = DatabaseService.blockedCache['GLOBAL'] || [];
        if (global.includes(fromCall)) return true;
        const chArr = DatabaseService.blockedCache[channelKey] || [];
        return chArr.includes(fromCall);
    }

    // add a callsign to the blocked list of a channel ('GLOBAL' for app-wide) and re-apply filters
    static async blockCallsign(channelKey: string, callsign: string): Promise<void> {
        const call = callsign.toUpperCase();
        const current = [...(DatabaseService.blockedCache[channelKey] || [])];
        if (!current.includes(call)) current.push(call);
        DatabaseService.blockedCache[channelKey] = current;
        await DatabaseService.persistBlockedCallsigns(channelKey, current);
        await DatabaseService.reapplyFilters();
    }

    // remove a single callsign from a channel's blocked list and re-apply filters
    static async unblockCallsign(channelKey: string, callsign: string): Promise<void> {
        const call = callsign.toUpperCase();
        const current = (DatabaseService.blockedCache[channelKey] || []).filter(c => c !== call);
        DatabaseService.blockedCache[channelKey] = current;
        await DatabaseService.persistBlockedCallsigns(channelKey, current);
        await DatabaseService.reapplyFilters();
    }

    // remove all blocked callsigns for a channel and re-apply filters
    static async clearBlockedCallsigns(channelKey: string): Promise<void> {
        DatabaseService.blockedCache[channelKey] = [];
        await DatabaseService.persistBlockedCallsigns(channelKey, []);
        await DatabaseService.reapplyFilters();
    }

    // persist a channel's blocked-callsigns list (upsert)
    private static async persistBlockedCallsigns(channelKey: string, list: string[]): Promise<void> {
        if (!DatabaseService.db) return;
        const joined = list.join(',');
        try {
            await DatabaseService.db.execute(
                `INSERT INTO ChatSettings (channel, audioEnabled, blockedCallsigns) VALUES ('${channelKey}', 1, '${joined}')
                 ON CONFLICT(channel) DO UPDATE SET blockedCallsigns = '${joined}';`
            );
        } catch (error) {
            LogS.log(1, 'Error persisting blocked callsigns:' + error);
        }
    }

    // re-read messages and re-apply channel + block filters, updating the store
    private static async reapplyFilters(): Promise<void> {
        const msgs = await DatabaseService.getTextMessages();
        const escMsgs = DatabaseService.escapeQuotesInArr(msgs);
        DatabaseService.applyFilters(escMsgs);
    }

    // sync snapshot of the blocked-callsigns cache, for populating the UI store
    static getBlockedCallsignsSnapshot(): Record<string, string[]> {
        return { ...DatabaseService.blockedCache };
    }

    // TEXT FILTERS - filter messages by content, either globally ('GLOBAL') or for one chat channel
    private static textFilterCache: Record<string, TextFilter[]> = {};

    // parse a raw textFilters column value into an array, tolerating missing/malformed JSON
    private static parseTextFilters(raw: string | null | undefined): TextFilter[] {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            LogS.log(1, 'Error parsing text filters JSON:' + error);
            return [];
        }
    }

    // (re)load the text-filter cache from the ChatSettings table
    static async loadTextFilterCache(): Promise<void> {
        DatabaseService.textFilterCache = {};
        if (DatabaseService.db) {
            try {
                const res = await DatabaseService.db.query('SELECT channel, textFilters FROM ChatSettings;');
                if (res.values) {
                    res.values.forEach((row: any) => {
                        DatabaseService.textFilterCache[row.channel] = DatabaseService.parseTextFilters(row.textFilters);
                    });
                }
            } catch (error) {
                LogS.log(1, 'Error loading text filter cache:' + error);
            }
        }
    }

    // check whether a message's text matches a text filter, globally or for a specific channel
    static isTextFiltered(msgTxt: string, channelKey: string): boolean {
        const matches = (filters: TextFilter[]) => filters.some(f => f.matchType === 'exact' ? msgTxt === f.text : msgTxt.includes(f.text));
        const global = DatabaseService.textFilterCache['GLOBAL'] || [];
        if (matches(global)) return true;
        const chArr = DatabaseService.textFilterCache[channelKey] || [];
        return matches(chArr);
    }

    // add a new text filter or update an existing one (matched by id) for a channel ('GLOBAL' for app-wide), then re-apply filters
    static async addOrUpdateTextFilter(channelKey: string, filter: TextFilter): Promise<void> {
        const current = [...(DatabaseService.textFilterCache[channelKey] || [])];
        const idx = current.findIndex(f => f.id === filter.id);
        if (idx > -1) current[idx] = filter; else current.push(filter);
        DatabaseService.textFilterCache[channelKey] = current;
        await DatabaseService.persistTextFilters(channelKey, current);
        await DatabaseService.reapplyFilters();
    }

    // remove a single text filter by id from a channel and re-apply filters
    static async removeTextFilter(channelKey: string, filterId: string): Promise<void> {
        const current = (DatabaseService.textFilterCache[channelKey] || []).filter(f => f.id !== filterId);
        DatabaseService.textFilterCache[channelKey] = current;
        await DatabaseService.persistTextFilters(channelKey, current);
        await DatabaseService.reapplyFilters();
    }

    // remove all text filters for a channel and re-apply filters
    static async clearTextFilters(channelKey: string): Promise<void> {
        DatabaseService.textFilterCache[channelKey] = [];
        await DatabaseService.persistTextFilters(channelKey, []);
        await DatabaseService.reapplyFilters();
    }

    // persist a channel's text filters as JSON (upsert). Uses parameterized values so special
    // characters, quotes and emojis (UTF-8) in the filter text can never break the SQL statement.
    private static async persistTextFilters(channelKey: string, filters: TextFilter[]): Promise<void> {
        if (!DatabaseService.db) return;
        const json = JSON.stringify(filters);
        try {
            await DatabaseService.db.run(
                `INSERT INTO ChatSettings (channel, audioEnabled, textFilters) VALUES (?, 1, ?)
                 ON CONFLICT(channel) DO UPDATE SET textFilters = ?;`,
                [channelKey, json, json]
            );
        } catch (error) {
            LogS.log(1, 'Error persisting text filters:' + error);
        }
    }

    // sync snapshot of the text-filter cache, for populating the UI store
    static getTextFiltersSnapshot(): Record<string, TextFilter[]> {
        return { ...DatabaseService.textFilterCache };
    }

}

export default DatabaseService;