import {SSManager} from "../../ssmanager";

export class PluginsController {
    public getPlugins = async (req, res, next) => {
        res.json({games: SSManager.configsController.plugins});
    };
}