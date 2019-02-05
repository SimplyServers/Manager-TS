import {SSManager} from "../../SSManager";

export class GamesController {
    public getGames = async (req, res, next) => {
        res.json({games: SSManager.configsController.games});
    };
}