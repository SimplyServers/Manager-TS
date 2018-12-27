import * as SSUtil from "../../../util/util";
import * as path from 'path';
import {SSManager} from "../../../server";
import {IGame} from "./gameConfig";

class ConfigsController {
    public games: Array<IGame>;
    public plugins: Array<IPlugin>;

    private readonly dataFolder: string;

    constructor(dataFolder: string) {
        this.dataFolder = dataFolder;
    }

    public loadGames = async () => {
        this.games = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/games/"));
    };

    public loadPlugins = async () => {
        this.plugins = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/plugins/"));
    };
}

export { ConfigsController };