import * as SSUtil from "../../../util/util";
import * as path from "path";
import {SSManager} from "../../../ssmanager";
import {Gameserver} from "./gameserver";
import {IServer} from "../configs/serverConfig";

class GameserverController{
    public servers: Array<Gameserver>;

    private readonly dataFolder: string;

    constructor(dataFolder: string) {
        this.dataFolder = dataFolder;
    }

    public loadServers = async () => {
        this.servers = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/servers/"));
    };

    public getNiceConfigs = () => {
        let niceConfigs = [];
        this.servers.map(server => {
            niceConfigs.push(server.getInfo());
        });
        return niceConfigs;
    };

    public addNewServer = async (jsonData: IServer) => {
        const newServer = new Gameserver(jsonData);
        this.servers.push(newServer);
        await newServer.updateConfig();
        return newServer;
    }
}

export { GameserverController }