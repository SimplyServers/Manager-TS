import * as SSUtil from "../../../util/util";
import * as path from "path";
import {SSManager} from "../../../ssmanager";
import {Gameserver} from "./gameserver";
import {IServer} from "../configs/serverConfig";
import {ConfigsController} from "../configs/configManager";

class GameserverController{
    public servers: Array<Gameserver>;

    private readonly dataFolder: string;

    private readonly configsController: ConfigsController;

    constructor(dataFolder: string, configsController: ConfigsController) {
        this.dataFolder = dataFolder;
        this.configsController = configsController;

        this.servers = [];
    }

    public loadServers = async () => {
        const serversJSON = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/servers/"));
        serversJSON.map(server => {
            this.servers.push(new Gameserver(server, this.configsController));
        })
    };

    public getNiceConfigs = () => {
        let niceConfigs = [];
        this.servers.map(server => {
            niceConfigs.push(server.getInfo());
        });
        return niceConfigs;
    };

    public addNewServer = async (jsonData: IServer) => {
        const newServer = new Gameserver(jsonData, this.configsController);
        this.servers.push(newServer);
        await newServer.updateConfig();
        return newServer;
    }

    public removeServer = async (targetServer: Gameserver) => {
        let removed = false;
        await Promise.all(this.servers.map(async (server, index) => {
            if(server === targetServer){
                removed = true;
                await targetServer.remove();
                this.servers.splice(index, 1);
            }
        }));
        return removed;
    }
}

export { GameserverController }