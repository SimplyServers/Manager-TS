import {Gameserver} from "../gameserver";

class Helper{
    protected readonly server: Gameserver;

    constructor(server: Gameserver){
        this.server = server;
    }
}

export {Helper}