import * as express from 'express'

import {SSManager} from "../ssmanager";
import {ConfigsController} from "../manager/controllers/configs/configManager";
import {GameserverController} from "../manager/controllers/gameserver/gameserverManager";
import {AuthMiddleware} from "./middleware/auth";
import {ServerMiddleware} from "./middleware/server";
import {GamesController} from "./controllers/games";
import {NodeController} from "./controllers/node";
import {PluginsController} from "./controllers/plugins";

class APIServer {
    public express;
    public http;
    static io;

    private readonly configsController;
    private readonly serverController;

    private readonly authMiddleware;
    private readonly serverMiddleware;

    constructor(configsController: ConfigsController, serverController: GameserverController) {
        this.express = express();

        this.configsController = configsController;
        this.serverController = serverController;

        this.authMiddleware = new AuthMiddleware();
        this.serverMiddleware = new ServerMiddleware();
    }

    public bootstrapExpress = (): void => {
        //Pass controllers to the app for safe keeping (access via req.locals.configsController for ex.)
        this.express.locals.configsController = this.configsController;
        this.express.locals.serverController = this.serverController;

        //CORS
        this.express.disable('x-powered-by');
        this.express.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers",
                "Origin, X-Requeted-With, Content-Type, Accept, Authorization, RBR");
            if (req.headers.origin) {
                res.header('Access-Control-Allow-Origin', req.headers.origin);
            }
            if (req.method === 'OPTIONS') {
                res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
                return res.status(200).json({});
            }
            next();
        });

        //Basic home page
        this.express.get('/', function (req, res) {
            res.set('location', 'https://simplyservers.io');
            res.status(301).send()
        });

        //Error handling
        this.express.use(function (err, req, res, next) {
            if (err.name === 'ServerActionError') {
                res.status(500);
                if (err.showInProd) {
                    res.json({
                        "error": true,
                        "msg": err.message
                    });
                } else {
                    res.status(500);
                    SSManager.logger.error(err);
                    res.json({
                        "error": true,
                        "msg": "Action failed."
                    });
                }
            } else if (err.name === 'ValidationError') {
                res.status(400);
                res.json({
                    "error": true,
                    "msg": "Validation error.",
                    "field": err.field
                });
            } else if (err.name === 'FileError') {
                res.status(500);
                res.json({
                    "error": true,
                    "msg": err.message,
                    "file": err.file
                });
            } else {
                SSManager.logger.error(err);
                res.status(500);
                res.json({
                    "error": true,
                    "msg": err.toString()
                });
            }
        });

        this.mountRoutes();
        this.createHttp();
    };

    private createHttp = (): void => {
        SSManager.logger.verbose("HTTP server hosted on :" + SSManager.config.api.port);
        this.http = this.express.listen(SSManager.config.api.port);
    };

    private mountRoutes = (): void => {
        const apiRouter = require('express').Router();

        //games.ts
        const gamesController = new GamesController();
        apiRouter.get('/games/', [this.authMiddleware.authRequired], gamesController.getGames);

        //plugins.ts
        const pluginsController = new PluginsController();
        apiRouter.get('/plugins/', [this.authMiddleware.authRequired], pluginsController.getPlugins);

        //node.ts
        const nodeController = new NodeController();
        apiRouter.get('/node', [this.authMiddleware.authRequired], nodeController.getStatus);

        this.express.use('', apiRouter);
    };
}

export { APIServer }