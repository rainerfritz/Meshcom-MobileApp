import { MheardType } from "./AppInterfaces";
import MhStore from "../store/MheardStore";

class MheardStaticStore {

    mhArr_s:MheardType [];

    constructor(){
        this.mhArr_s = [];
    }

    getMhArr(){
        return this.mhArr_s;
    }

    setMhArr(mheard:MheardType){
        //if we have the mheard in the array, update it
        //console.log("Mheard Static Store: " + JSON.stringify(mheard));
        let mhfound = false;

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
}

export default new MheardStaticStore();