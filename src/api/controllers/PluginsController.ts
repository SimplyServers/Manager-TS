import { SSManager } from "../../SSManager";

export class PluginsController {
  public getPlugins = async (req, res, next) => {
    res.json({ games: SSManager.configsController.plugins });
  };
}