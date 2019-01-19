import * as path from 'path';
import {SSManager} from "../../../ssmanager";
import * as SSUtil from "../../../util/util";
import {IGame} from "./gameConfig";
import {IPlugin} from "./pluginConfig";

export class ConfigsController {
    public games: IGame[];
    public plugins: IPlugin[];

    private readonly dataFolder: string;

    constructor(dataFolder: string) {
        this.dataFolder = dataFolder;
    }

    public loadGames = async (): Promise<void> => {
        this.games = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/games/"));
    };

    public loadPlugins = async (): Promise<void> => {
        this.plugins = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/plugins/"));
    };
}
