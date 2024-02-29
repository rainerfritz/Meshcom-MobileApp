import {Store} from "pullstate";
import { MheardType } from "../utils/AppInterfaces";


let mhArr_:MheardType [] = [];

const MhStore = new Store({
    mhArr:mhArr_
});

export default MhStore