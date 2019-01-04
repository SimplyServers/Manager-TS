import {SSManager} from "../../ssmanager";

class PluginsController {
    public getPlugins = async (req, res, next) => {
        res.json({games: SSManager.configsController.plugins});
    };
}

export {PluginsController}