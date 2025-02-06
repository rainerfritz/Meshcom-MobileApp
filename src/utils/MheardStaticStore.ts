import { MheardType } from "./AppInterfaces";
import MhStore from "../store/MheardStore";
import { PosType } from "./AppInterfaces";


class MheardStaticStore {

    mhArr_s:MheardType [];
    cachedPos:PosType [];

    constructor(){
        this.mhArr_s = [];
        this.cachedPos = [];
    }

    getMhArr(){
        return this.mhArr_s;
    }

    setMhArr(mheard:MheardType){
        //if we have the mheard in the array, update it
        console.log("Mheard Static Store: " + JSON.stringify(mheard));
        let mhfound = false;
        let mh_dateStr = mheard.mh_date + "T" + mheard.mh_time;
        //console.log("Mheard DateTimeString: " + mh_dateStr);
        mheard.mh_timestamp = new Date(mh_dateStr).getTime();
        //console.log("Mheard Timestamp: " + mheard.mh_timestamp);
        

        this.mhArr_s.forEach((mh)=>{
            if(mheard.mh_callSign === mh.mh_callSign && mheard.mh_nodecall === mh.mh_nodecall){
                mhfound = true;
            }
        });

        if(!mhfound){
            console.log("Mheard Static Store: adding mheard");
            this.mhArr_s.push(mheard);
            this.mhArr_s.sort(function(y, x){
                return x.mh_timestamp - y.mh_timestamp;
            });

            MhStore.update(s=>{
                s.mhArr = [];
                this.mhArr_s.forEach((mh)=>{
                    s.mhArr.push(mh);
                });
            });
        }

        if(mhfound){
            console.log("Mheard Static Store: updating mheard");
            const filtered_mh = this.mhArr_s.filter(mhs => mhs.mh_callSign !== mheard.mh_callSign);
            filtered_mh.push(mheard);
            this.mhArr_s = filtered_mh;
            this.mhArr_s.sort(function(y, x){
                return x.mh_timestamp - y.mh_timestamp;
            });

            MhStore.update(s=>{
                s.mhArr = [];
                this.mhArr_s.forEach((mh)=>{
                    s.mhArr.push(mh);
                });
            });
        }
    }

    setCachedPos(pos:PosType){
        this.cachedPos.push(pos);
    }

    getCachedPos(mh_callSign:string){
        const filtered_pos = this.cachedPos.filter(pos => pos.callSign === mh_callSign);
        return filtered_pos;
    }

    clearMheards(){
        this.mhArr_s = [];
        MhStore.update(s=>{
            s.mhArr = [];
        });
        console.log("Mheard Static Store: Clearing Mheards");
    }
}

export default new MheardStaticStore();