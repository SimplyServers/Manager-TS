import {SSManager} from "../../ssmanager";

export class GamesController {
    public getGames = async (req, res, next) => {
        res.json({games: SSManager.configsController.games});
    };
}