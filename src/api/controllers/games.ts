class GamesController{
    public getGames = async (req, res, next) => {
      res.json({games: req.app.locals.configsController.games});
    };
}

export { GamesController }