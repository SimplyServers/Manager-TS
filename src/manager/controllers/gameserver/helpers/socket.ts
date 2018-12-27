import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

class SocketHelper extends Helper{
    constructor(server: Gameserver){
        super(server);
    }
}

export { SocketHelper }