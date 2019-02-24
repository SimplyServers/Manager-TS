import {SSManager} from "../../SSManager";

export class PluginsController {
    public getPlugins = async (req, res, next) => {
        res.json({plugins: SSManager.configsController.plugins});
    };
}
