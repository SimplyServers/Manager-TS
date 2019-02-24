import {ConfigsController} from "./manager/controllers/configs/ConfigsController";
import {IConfig} from "./util/IConfig";
import {Logger} from './util/Logger';

import * as configData from "../config.json";
import {APIServer} from "./api/APIServer";
import {GameserverController} from "./manager/controllers/gameserver/GameServerController";
import {DockerInstaller} from "./manager/DockerInstaller";

export class SSManager {
    public static config: IConfig;
    public static logger: Logger;
    public static loaded: boolean;

    public static configsController;
    public static serverController;
    public static APIServer;

    public static getRoot(): string {
        return __dirname;
    }

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

    private bootstrap = async (): Promise<void> => {
        // Bootstrap docker
        const dockerInstaller = new DockerInstaller();
        SSManager.logger.info("Checking Docker images...");
        await dockerInstaller.bootstrap();

        // Load API
        SSManager.APIServer = new APIServer();
        SSManager.logger.info("Loading API...");
        await SSManager.APIServer.bootstrapExpress();

        // Bootstrap configs
        SSManager.configsController = new ConfigsController("../storage/");
        SSManager.logger.info("Loading games...");
        await SSManager.configsController.loadGames();

        SSManager.logger.info("Loading plugins...");
        await SSManager.configsController.loadPlugins();

        // Bootstrap servers
        SSManager.serverController = new GameserverController("../storage/");
        SSManager.logger.info("Loading servers...");
        await SSManager.serverController.loadServers();
    };
}
