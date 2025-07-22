/**
 * Hardware Table ID to HW Name
 * 
 * //Hardware Types

#define TLORA_V2 1
#define TLORA_V1 2
#define TLORA_V2_1_1p6 3
#define TBEAM 4
#define TBEAM_1268 5
#define TBEAM_0p7 6
#define T_ECHO 7
#define T_DECK 8
#define RAK4631 9
#define HELTEC_V2_1 10
#define HELTEC_V1 11
#define TBEAM_AXP2101 12
#define EBYTE_E22 39
#define T5_EPAPER 40
#define HELTEC_TRACKER 41
#define HELTEC_STICK_V3 42
#define HELTEC_V3 43
#define HELTEC_E290 44
#define TBEAM_1262 45
#define T_DECK_PLUS 46
#define TBEAM_SUPREME_L76K 47
#define ESP32_S3_EBYTE_E22 48
#define TLORA_PAGER 49
 */


export const hwtable: {[key: number]: string} = {
    0:"Unknown",
    1:"TLORA V2",
    2:"TLORA V1",
    3:"TLORA V2.1.6",
    4:"TBEAM V1.1",
    5:"TBEAM V1.1 1268",
    6:"TBEAM V0.7",
    7:"T-ECHO",
    8:"T_DECK",
    9:"RAK4631",
    10:"HELTEC V2.1",
    11:"HELTEC V1",
    12:"TBEAM V1.2",
    39:"EBYTE E22",
    40:"T5 E-Paper",
    41:"HELTEC Tracker",
    42:"HELTEC Stick",
    43:"HELTEC V3",
    44:"HELTEC E290",
    45:"TBEAM V1.2 1262",
    46:"T-DECK+",
    47:"TBEAM Supreme",
    48:"EBYTE E22 S3",
    49:"TLORA Pager"
} 