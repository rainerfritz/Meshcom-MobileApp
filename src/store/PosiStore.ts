import {Store} from "pullstate";
import { PosType } from "../utils/AppInterfaces";


let posArr_:PosType [] = [];

const PosiStore = new Store({
    posArr:posArr_
});

export default PosiStore