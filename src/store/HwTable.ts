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
#define HELTEC_V3 43
#define HELTEC_E290 44
#define TBEAM_1262 45
#define T-DECK Plus 46
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
    43:"HELTEC V3",
    44:"HELTEC E290",
    45:"TBEAM V1.2 1262",
    46:"T-DECK +"
} 