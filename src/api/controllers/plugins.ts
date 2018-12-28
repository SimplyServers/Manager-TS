class PluginsController{
    public getPlugins = async (req, res, next) => {
        res.json({games: req.app.locals.configsController.plugins});
    };
}

export { PluginsController }