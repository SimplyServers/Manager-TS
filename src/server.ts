import {ConfigsController} from "./manager/controllers/configs/configs";
import {Logger} from './util/logger';

class SSManager{
    static logger: Logger;
    private configsController;

    constructor(){
        console.log("hi");
        SSManager.logger = new Logger(false);

        SSManager.logger.info("Starting bootstrap...");
        this.bootstrap().then(() => {
            SSManager.logger.info("Bootstrap finished.");
        }).catch((err) => {
            SSManager.logger.error("Failed to bootstrap; " + err)
        })
    }

    private bootstrap = async () => {
        //Bootstrap configs
        this.configsController = new ConfigsController("../storage/");
        SSManager.logger.info("Loading games...");
        await this.configsController.loadGames();
        SSManager.logger.info("Loading plugins...");
        await this.configsController.loadPlugins();

    };

    static getRoot(): string{
        return __dirname;
    }
}

export {SSManager}