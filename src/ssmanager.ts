import {ConfigsController} from "./manager/controllers/configs/configManager";
import {Logger} from './util/logger';
import {IConfig} from "./util/config";

import * as configData from "../config.json";
import {GameserverController} from "./manager/controllers/gameserver/gameserverManager";
import {APIServer} from "./api/server";
import {DockerInstaller} from "./manager/dockerInstaller";

class SSManager {
    static config: IConfig;
    static logger: Logger;
    static loaded: boolean;

    static configsController;
    static serverController;
    static APIServer;

    constructor() {
        SSManager.logger = new Logger(false);
        SSManager.config = configData;
        SSManager.loaded = false;

        SSManager.logger.info("▆▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃█  Simply Servers Manager  █▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▆");
        SSManager.logger.info("Starting bootstrap...");
        this.bootstrap().then(() => {
            SSManager.logger.info("Bootstrap finished.");
            SSManager.loaded = true;
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

        //Load API
        SSManager.APIServer = new APIServer();
        SSManager.logger.info("Loading API...");
        await SSManager.APIServer.bootstrapExpress();

        //Bootstrap configs
        SSManager.configsController = new ConfigsController("../storage/");
        SSManager.logger.info("Loading games...");
        await SSManager.configsController.loadGames();
        SSManager.logger.info("Loading plugins...");
        await SSManager.configsController.loadPlugins();

        //Bootstrap servers
        SSManager.serverController = new GameserverController("../storage/");
        SSManager.logger.info("Loading servers...");
        await SSManager.serverController.loadServers();
    };

    static getRoot(): string {
        return __dirname;
    }
}

export {SSManager}