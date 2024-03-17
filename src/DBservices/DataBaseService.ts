import {
    SQLiteDBConnection,
    SQLiteConnection,
    CapacitorSQLite,
  } from "@capacitor-community/sqlite";

import { MsgType, PosType } from "../utils/AppInterfaces";
import PosiStore from "../store/PosiStore";
import MsgStore from "../store/MsgStore";
import { format, compareAsc, sub } from "date-fns";
import { Capacitor } from "@capacitor/core";



class DatabaseService {

    static connection: SQLiteConnection | null = null;
    static db: SQLiteDBConnection | null = null;
    static dbName = 'meshcom.db';
    static isInit = false;
    static MAX_AGE_TXT_MSG = 5; // 5 days
    static MAX_AGE_POS = 7; // 7 days
    

    static async initializeDatabase() {
        try {
            if (!DatabaseService.connection) {
                const sqlite = new SQLiteConnection(CapacitorSQLite);
                DatabaseService.connection = sqlite as SQLiteConnection; // Cast to SQLiteConnection
                DatabaseService.db = await DatabaseService.connection.createConnection(this.dbName, false, 'no-encryption', 1, false);

                if (DatabaseService.db) {
                    try {
                        console.log('DB Name: ', DatabaseService.db?.getConnectionDBName());
                        console.log('Opening database:', DatabaseService.db);
                        await DatabaseService.db.open();
                        const res = await DatabaseService.db.isDBOpen();
                        if (res.result) {
                            console.log('Database is open');
                        } else {
                            console.error('Database is not open');
                        }
                    } catch (error) {
                        console.error('Error opening database:', error);
                    }
                    
                }

                // Your database initialization logic here
                // For example: Create tables if they don't exist
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
                            notify INTEGER
                        )
                    `).catch((err) => {
                        console.error('Error creating TextMessages table:', err);
                    });
                }

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
                            gas_res REAL
                        )
                    `).catch((err) => {
                        console.error('Error creating Positions table:', err);
                    });
                }

                /*if (DatabaseService.db) {
                    console.log('Creating reconState table');
                    await DatabaseService.db.execute(`CREATE TABLE IF NOT EXISTS reconState (
                        id INTEGER PRIMARY KEY NOT NULL,
                        reconStateVal INTEGER NOT NULL
                    );`).catch((err) => {
                            console.error('Error creating reconState table:', err);
                    });
                    
                    const res = await DatabaseService.db?.query('SELECT * FROM reconState');
                    console.log('reconState:', res?.values);
                    if (res.values === undefined || res.values.length === 0) {
                        console.log('reconState table is empty, adding default value');
                        await DatabaseService.db?.execute('INSERT INTO reconState (id,reconStateVal) VALUES (0,0);');

                        const res = await DatabaseService.db?.query('SELECT * FROM reconState');
                        console.log('reconState after insert:', res?.values);
                    }

                } else {
                    console.error('Error creating tables. Database connection not open.');
                }*/

                // housekeeping
                await DatabaseService.housekeeping();

                // update the store with txt messages
                const txtMsgs = await DatabaseService.getTextMessages();
                const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);

                if (txtMsgs.length > 0) {
                    MsgStore.update(s => {
                        s.msgArr = escTxtMsgs;
                    });
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
            console.error('Error initializing database:', error);
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
                    return res.values;
                }
            } catch (error) {
                console.error('Error getting text messages:', error);
            }
        } else {
            console.error('Error getting text messages. Database not open.');
        }
        return [];
    }

    // writeTxtMsg to the TextMessages table
    static async writeTxtMsg(msg: MsgType) {
        msg.msgTXT = DatabaseService.escapeQuotes(msg.msgTXT);

        if (DatabaseService.db) {
            // check first if we have that message alredy in the database
            const res = await DatabaseService.db.query(`SELECT * FROM TextMessages WHERE msgNr = ${msg.msgNr} AND fromCall = '${msg.fromCall}' AND msgTXT = '${msg.msgTXT}'`);
            if (res.values && res.values.length > 0) {
                console.log('DB Writing Txt Msg: Message already in database');
                return;
            }

            console.log('DB Writing text message:', msg);
            try {
                const id = Date.now();
                const query_str = `INSERT INTO TextMessages (id,timestamp, msgNr, msgTime, fromCall, toCall, msgTXT, via, ack, isDM, notify) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
                const values = [id, msg.timestamp, msg.msgNr, msg.msgTime, msg.fromCall, msg.toCall, msg.msgTXT, msg.via, msg.ack, msg.isDM, msg.notify];
                const ret = await DatabaseService.db.run(query_str, values);
                console.log('DB writeTxtMsg ret:', ret.changes?.values);
                // read back all messages
                const txtMsgs = await DatabaseService.getTextMessages();
                const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);
                // update the store
                MsgStore.update(s => {
                    s.msgArr = escTxtMsgs;
                });
            } catch (error) {
                console.error('Error writing text message:', error);
            }
        } else {
            console.error('Error writing text message. Database not open.');
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
            console.log('DB Acknowledging text message:', msgNr);
            try {
                // get message(s) with msgNr
                const res = await DatabaseService.db.query(`SELECT * FROM TextMessages WHERE msgNr = ${msgNr}`);
                if (res.values) {
                    if(res.values.length > 1) {
                        console.error("More than one message with the same msgNr!");
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

                            // update in DB
                            const query_str = `UPDATE TextMessages SET ack = ${msg.ack} WHERE msgNr = ${msgNr}`;
                            const ret = await DatabaseService.db.execute(query_str);
                            console.log('DB ackTxtMsg ret:', ret.changes);
                            // read back all messages
                            const txtMsgs = await DatabaseService.getTextMessages();
                            const escTxtMsgs = DatabaseService.escapeQuotesInArr(txtMsgs);
                            if (txtMsgs.length > 0) {
                                MsgStore.update(s => {
                                    s.msgArr = escTxtMsgs;
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error acknowledging text message:', error);
            }
        } else {
            console.error('Error acknowledging text message. Database not open.');
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
                console.error('Error getting positions:', error);
            }
        } else {
            console.error('Error getting positions. Database not open.');
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
                console.error('Error getting position:', error);
            }
        } else {
            console.error('Error getting position. Database not open.');
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
                const query_str = `INSERT INTO positions (id,timestamp, callSign, lat, lon, alt, bat, hw, pressure, temperature, humidity, qnh, comment, temp_2, co2, alt_press, gas_res) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
                const values = [id, pos.timestamp, pos.callSign, pos.lat, pos.lon, pos.alt, pos.bat, pos.hw, pos.pressure, pos.temperature, pos.humidity, pos.qnh, pos.comment, pos.temp_2, pos.co2, pos.alt_press, pos.gas_res];
                const ret = await DatabaseService.db.run(query_str, values);
                console.log('DB writePos ret:', ret.changes?.values);
                // update the store
                PosiStore.update(s => {
                    s.posArr.push(pos);
                });
            } catch (error) {
                console.error('Error writing position:', error);
            }
        } else {
            console.error('Error writing position. Database connection not open.');
        }
    }


    // update a position in the Positions table from a specific callsign
    static async updatePos(pos: PosType) {
        if (DatabaseService.db) {
            console.log('DB Updating position:', pos.callSign);
            try {
                const query_str = `UPDATE positions SET timestamp = ?, lat = ?, lon = ?, alt = ?, bat = ?, hw = ?, pressure = ?, temperature = ?, humidity = ?, qnh = ?, comment = ?, temp_2 = ?, co2 = ?, alt_press = ?, gas_res = ? WHERE callSign = ?`;
                const values = [pos.timestamp, pos.lat, pos.lon, pos.alt, pos.bat, pos.hw, pos.pressure, pos.temperature, pos.humidity, pos.qnh, pos.comment, pos.temp_2, pos.co2, pos.alt_press, pos.gas_res, pos.callSign];
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
                console.error('Error updating position:', error);
            }
        } else {
            console.error('Error updating position. Database connection not open.');
        }
    }


    // check if we have db connection and db is open
    static async checkDbConn() {
        // check if we have connection
        const conn = await DatabaseService.connection?.isConnection(DatabaseService.dbName, false);
        if (conn?.result) {
            console.log('DB - checking Connection:', conn);
        } else {
            console.error('Database connection not open');
            // create a new connection
            try {
                console.log('Creating new connection');
                const sqlite = new SQLiteConnection(CapacitorSQLite);
                DatabaseService.connection = sqlite as SQLiteConnection; // Cast to SQLiteConnection
                await DatabaseService.connection.createConnection(DatabaseService.dbName, false, 'no-encryption', 1, false);
            } catch (error) {
                console.error('Error creating new connection:', error);
            }
        }
        // check if db is open
        if (DatabaseService.db) {
            const res = await DatabaseService.db.isDBOpen();
            if (res.result) {
                console.log('Database is open');
            } else {
                console.error('Database is not open');
                // open the database
                try {
                    console.log('Opening database');
                    await DatabaseService.db.open();
                    // check if db is open
                    const res = await DatabaseService.db.isDBOpen();
                    if (res.result) {
                        console.log('Database is open');
                    } else {
                        console.error('Database is not open');
                    }
                } catch (error) {
                    console.error('Error opening database:', error);
                }
            }
        } else {
            console.error('Database connection not open');
        }
    }

     
    // close the database connection
    static async closeConnection() {
        if (DatabaseService.db) {
            console.log('DB Closing database');
            try {
                await DatabaseService.db.close();
                await DatabaseService.connection?.closeConnection(this.dbName, false);
            } catch (error) {
                console.error('Error closing database:', error);
            }
        }
    }

    // return reconStateVal
    /*static async getReconState() {
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

    // set reconStateVal
    static async setReconState(val: number) {
        if (DatabaseService.db) {
            console.log('DB Setting reconState:', val);
            try {
                await DatabaseService.db.execute(`UPDATE reconState SET reconStateVal = ${val} WHERE id = 0;`);
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
    }*/

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
        console.log('DB Housekeeping');
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
            console.error('Error housekeeping. Database not open.');
        }
    }
}

export default DatabaseService;