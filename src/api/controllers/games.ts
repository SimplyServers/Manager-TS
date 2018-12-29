import {SSManager} from "../../ssmanager";

class GamesController{
    public getGames = async (req, res, next) => {
      res.json({games: SSManager.configsController.games});
    };
}

export { GamesController }