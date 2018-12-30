import * as express from 'express'
import * as SocketIO from 'socket.io';
import * as bodyParser from "body-parser";
import * as https from "https";

import {SSManager} from "../ssmanager";
import {ConfigsController} from "../manager/controllers/configs/configManager";
import {GameserverController} from "../manager/controllers/gameserver/gameserverManager";
import {AuthMiddleware} from "./middleware/auth";
import {ServerMiddleware} from "./middleware/server";
import {GamesController} from "./controllers/games";
import {NodeController} from "./controllers/node";
import {PluginsController} from "./controllers/plugins";
import {ServersController} from "./controllers/gameserver";
import {LoadedMiddleware} from "./middleware/loaded";
import {CertManager} from "./certManager";

class APIServer {
    public express;
    public http;
    public io;

    private readonly authMiddleware;
    private readonly serverMiddleware;

    private readonly certManager;

    constructor() {
        this.express = express();

        this.authMiddleware = new AuthMiddleware();
        this.serverMiddleware = new ServerMiddleware();

        this.certManager = new CertManager();
    }

    public bootstrapExpress = async () => {
        //Make sure certs are installed
        await this.certManager.ensureCerts();

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

        //Body Parser
        this.express.use(bodyParser.urlencoded({extended: false})); //Allow Express to handle json in bodies
        this.express.use(bodyParser.json()); //                                ^

        //Basic home page
        this.express.get('/', function (req, res) {
            res.set('location', 'https://simplyservers.io');
            res.status(301).send()
        });

        //Global middleware
        const mustBeLoaded = new LoadedMiddleware();
        this.express.use(mustBeLoaded.mustBeLoaded);

        this.mountRoutes();

        //Error handling
        this.express.use(function (err, req, res, next) {
            console.log("proper error handler fired.");
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

        await this.createHttp();
    };

    private createHttp = async ()  => {
        SSManager.logger.verbose("HTTP server hosted on :" + SSManager.config.api.port);

        this.http = https.createServer(await this.certManager.getOptions(), this.express);
        this.io = SocketIO(this.http, {
            path: "/s/"
        });
        this.http.listen(SSManager.config.api.port);
    };

    private mountRoutes = (): void => {
        const apiRouter = require('express').Router();

        //games.ts
        const gamesController = new GamesController();
        apiRouter.get('/game/', [this.authMiddleware.authRequired], gamesController.getGames);

        //plugins.ts
        const pluginsController = new PluginsController();
        apiRouter.get('/plugin/', [this.authMiddleware.authRequired], pluginsController.getPlugins);

        //node.ts
        const nodeController = new NodeController();
        apiRouter.get('/node/', [this.authMiddleware.authRequired], nodeController.getStatus);

        //gameserver.ts
        const gameserverController = new ServersController();
        apiRouter.get('/server/', [this.authMiddleware.authRequired], gameserverController.getGameservers);
        apiRouter.get('/server/:server', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.getServer);
        apiRouter.post('/server/:server/resetPassword', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.resetPassword);
        apiRouter.post('/server/:server/writeFile', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.writeFile);
        apiRouter.post('/server/:server/removeFile', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.removeFile);
        apiRouter.post('/server/:server/fileContents', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.fileContents);
        apiRouter.post('/server/:server/getDir', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.getDir);
        apiRouter.post('/server/:server/execute', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.execute);
        apiRouter.get('/server/:server/power/:power', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.power);
        apiRouter.get('/server/:server/reinstall', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.reinstall);
        apiRouter.post('/server/:server/edit', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.edit);
        apiRouter.get('/server/:server/update', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.update);
        apiRouter.get('/server/:server/install', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.install);
        apiRouter.get('/server/:server/remove', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.remove);
        apiRouter.post('/server/:server/removePlugin', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.removePlugin);
        apiRouter.post('/server/:server/installPlugin', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.installPlugin);
        apiRouter.get('/server/:server/plugins/', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.getPlugins);
        apiRouter.post('/server/add', [this.authMiddleware.authRequired], gameserverController.add);

        this.express.use('', apiRouter);
    };
}

export { APIServer }