import * as SSUtil from "../../../util/util";
import * as path from "path";
import {SSManager} from "../../../server";
import {Gameserver} from "./gameserver";

class GameserverController{
    public servers: Array<Gameserver>;

    private readonly dataFolder: string;

    constructor(dataFolder: string) {
        this.dataFolder = dataFolder;
    }

    public loadServers = async () => {
        this.servers = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/servers/"));
    }

    public getNiceConfigs(): any{

    }

    public addNewServer(jsonData): void{

    }
}