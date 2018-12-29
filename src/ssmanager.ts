import {ConfigsController} from "./manager/controllers/configs/configManager";
import {Logger} from './util/logger';
import {Gameserver} from "./manager/controllers/gameserver/gameserver";
import {IConfig} from "./util/config";

import * as configData from "../config.json";
import {GameserverController} from "./manager/controllers/gameserver/gameserverManager";
import {APIServer} from "./api/server";
import {DockerInstaller} from "./manager/dockerInstaller";

class SSManager {
    static config: IConfig;
    static logger: Logger;

    private configsController;
    private serverController;
    private APIServer;

    constructor() {
        SSManager.logger = new Logger(false);
        SSManager.config = configData;

        SSManager.logger.info("▆▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃█  Simply Servers Manager  █▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▆");
        SSManager.logger.info("Starting bootstrap...");
        this.bootstrap().then(() => {
            SSManager.logger.info("Bootstrap finished.");
            SSManager.logger.info("▆▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▆");
        }).catch((err) => {
            SSManager.logger.error("Failed to bootstrap; " + err)
        })
    }

    private bootstrap = async () => {
        //Bootstrap docker
        const dockerInstaller = new DockerInstaller();
        SSManager.logger.info("Checking Docker images...");
        await dockerInstaller.bootstrap();

        //Bootstrap configs
        this.configsController = new ConfigsController("../storage/");
        SSManager.logger.info("Loading games...");
        await this.configsController.loadGames();
        SSManager.logger.info("Loading plugins...");
        await this.configsController.loadPlugins();

        //Bootstrap servers
        this.serverController = new GameserverController("../storage/", this.configsController);
        SSManager.logger.info("Loading servers...");
        await this.serverController.loadServers();

        //Load API
        this.APIServer = new APIServer(this.configsController, this.serverController);
        SSManager.logger.info("Loading API...");
        this.APIServer.bootstrapExpress();
    };

    static getRoot(): string {
        return __dirname;
    }
}

export {SSManager}