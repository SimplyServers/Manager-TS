import { ConfigsController } from "./manager/controllers/configs/ConfigsController";
import { IConfig } from "./util/IConfig";
import { Logger } from "./util/Logger";

import * as configData from "../config.json";
import { APIServer } from "./api/APIServer";
import { GameserverController } from "./manager/controllers/gameserver/GameServerController";
import { DockerInstaller } from "./manager/dockerInstaller";

export class SSManager {
  private _bootstrap = async (): Promise<void> => {
    // Bootstrap docker
    const dockerInstaller = new DockerInstaller();
    SSManager._logger.info("Checking Docker images...");
    await dockerInstaller.bootstrap();

    // Load API
    SSManager.APIServer = new APIServer();
    SSManager._logger.info("Loading API...");
    await SSManager.APIServer.bootstrapExpress();

    // Bootstrap configs
    SSManager.configsController = new ConfigsController("../storage/");
    SSManager._logger.info("Loading games...");
    await SSManager.configsController.loadGames();

    SSManager._logger.info("Loading plugins...");
    await SSManager.configsController.loadPlugins();

    // Bootstrap servers
    SSManager.serverController = new GameserverController("../storage/");
    SSManager._logger.info("Loading servers...");
    await SSManager.serverController.loadServers();
  };

  constructor() {
    SSManager._logger = new Logger(false);
    SSManager._config = configData;
    SSManager.loaded = false;

    SSManager._logger.info("▆▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃█  Simply Servers Manager  █▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▆");
    SSManager._logger.info("Starting bootstrap...");
    this._bootstrap().then(() => {
      SSManager._logger.info("Bootstrap finished.");
      SSManager.loaded = true;
      SSManager._logger.info("▆▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▆");
    }).catch((err) => {
      SSManager._logger.error("Failed to bootstrap; " + err);
    });
  }

  private static _config: IConfig;

  static get config(): IConfig {
    return this._config;
  }

  static set config(value: IConfig) {
    this._config = value;
  }

  private static _logger: Logger;

  static get logger(): Logger {
    return this._logger;
  }

  static set logger(value: Logger) {
    this._logger = value;
  }

  private static _loaded: boolean;

  static get loaded(): boolean {
    return this._loaded;
  }

  static set loaded(value: boolean) {
    this._loaded = value;
  }

  private static _configsController: ConfigsController;

  static get configsController(): ConfigsController {
    return this._configsController;
  }

  static set configsController(value: ConfigsController) {
    this._configsController = value;
  }

  private static _serverController: GameserverController;

  static get serverController(): GameserverController {
    return this._serverController;
  }

  static set serverController(value: GameserverController) {
    this._serverController = value;
  }

  private static _APIServer: APIServer;

  static get APIServer(): APIServer {
    return this._APIServer;
  }

  static set APIServer(value: APIServer) {
    this._APIServer = value;
  }

  public static getRoot(): string {
    return __dirname;
  }
}