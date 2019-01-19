import * as path from "path";
import {SSManager} from "../../../ssmanager";
import * as SSUtil from "../../../util/util";
import {IServer} from "../configs/serverConfig";
import {Gameserver} from "./gameserver";

export class GameserverController {
    public servers: Gameserver[];

    private readonly dataFolder: string;

    constructor(dataFolder: string) {
        this.dataFolder = dataFolder;

        this.servers = [];
    }

    public loadServers = async (): Promise<void> => {
        const serversJSON = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/servers/"));
        serversJSON.map(server => {
            this.servers.push(new Gameserver(server));
        })
    };

    public getNiceConfigs = (): object => {
        const niceConfigs = [];
        this.servers.map(server => {
            niceConfigs.push(server.getInfo());
        });
        return niceConfigs;
    };

    public addNewServer = async (jsonData: IServer): Promise<Gameserver> => {
        const newServer = new Gameserver(jsonData);
        this.servers.push(newServer);
        await newServer.updateConfig();
        return newServer;
    };

    public removeServer = async (targetServer: Gameserver): Promise<boolean> => {
        let removed = false;
        await Promise.all(this.servers.map(async (server, index) => {
            if (server === targetServer) {
                removed = true;
                await targetServer.remove();
                this.servers.splice(index, 1);
            }
        }));
        return removed;
    }
}