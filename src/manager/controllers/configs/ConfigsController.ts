import * as path from "path";
import { SSManager } from "../../../SSManager";
import * as SSUtil from "../../../util/Util";
import { IGame } from "./IGame";
import { IPlugin } from "./IPlugin";

export class ConfigsController {
  public games: IGame[];
  public plugins: IPlugin[];
  public loadGames = async (): Promise<void> => {
    this.games = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/games/"));
  };
  public loadPlugins = async (): Promise<void> => {
    this.plugins = await SSUtil.dirToJson(path.join(SSManager.getRoot(), this.dataFolder, "/plugins/"));
  };
  private readonly dataFolder: string;

  constructor(dataFolder: string) {
    this.dataFolder = dataFolder;
  }
}
