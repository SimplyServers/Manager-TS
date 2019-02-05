import * as bodyParser from "body-parser";
import * as express from 'express'
import * as https from "https";
import * as SocketIO from 'socket.io';

import {GameServer} from "../manager/controllers/gameserver/GameServer";
import {SSManager} from "../SSManager";
import {CertManager} from "./CertManager";
import {GamesController} from "./controllers/GamesController";
import {ServersController} from "./controllers/ServersController";
import {NodeController} from "./controllers/NodeController";
import {PluginsController} from "./controllers/PluginsController";
import {AuthMiddleware} from "./middleware/AuthMiddleware";
import {LoadedMiddleware} from "./middleware/LoadedMiddleware";
import {ServerMiddleware} from "./middleware/ServerMiddleware";

export class APIServer {
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

    public bootstrapExpress = async (): Promise<void> => {
        // Make sure certs are installed
        await this.certManager.ensureCerts();

        // CORS
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

        // Body Parser
        this.express.use(bodyParser.urlencoded({extended: false})); // Allow Express to handle json in bodies
        this.express.use(bodyParser.json()); //                                ^

        // Basic home page
        this.express.get('/', function (req, res) {
            res.set('location', 'https://simplyservers.io');
            res.status(301).send()
        });

        // Global middleware
        const mustBeLoaded = new LoadedMiddleware();
        this.express.use(mustBeLoaded.mustBeLoaded);

        this.mountRoutes();

        // Error handling
        this.express.use(function (err, req, res, next) {
            if (err.code && err.code === 'SERVERERROR') {
                res.status(500);
                res.json({
                    "error": true,
                    "msg": err.message
                });
            } else if (err.code && err.code === 'VALIDATIONERROR') {
                res.status(400);
                res.json({
                    "error": true,
                    "msg": "VALIDATION_ERROR",
                    "field": err.field
                });
            } else if (err.code && err.code === 'FILEERROR') {
                res.status(500);
                res.json({
                    "error": true,
                    "msg": err.message,
                    "file": err.file
                });
            } else if (err.code && err.code === 'ENOENT') {
                res.status(500);
                res.json({
                    "error": true,
                    "msg": "FILE_NOT_FOUND",
                    "file": err.path
                });
            } else {
                console.log(err);
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

    private createHttp = async (): Promise<void> => {
        SSManager.logger.verbose("HTTP server hosted on :" + SSManager.config.api.port);

        this.http = https.createServer(await this.certManager.getOptions(), this.express);
        this.io = SocketIO(this.http, {
            path: "/s/"
        });
        this.http.listen(SSManager.config.api.port);
    };

    private mountRoutes = (): void => {
        const apiRouter = require('express').Router();

        // GamesController.ts
        const gamesController = new GamesController();
        apiRouter.get('/game/', [this.authMiddleware.authRequired], gamesController.getGames);

        // PluginsController.ts
        const pluginsController = new PluginsController();
        apiRouter.get('/plugin/', [this.authMiddleware.authRequired], pluginsController.getPlugins);

        // NodeController.ts
        const nodeController = new NodeController();
        apiRouter.get('/node/', [this.authMiddleware.authRequired], nodeController.getStatus);

        // ServersController.ts
        const gameserverController = new ServersController();
        apiRouter.get('/server/', [this.authMiddleware.authRequired], gameserverController.getGameservers);
        apiRouter.get('/server/:server', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.getServer);
        apiRouter.post('/server/:server/resetPassword', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.resetPassword);
        apiRouter.post('/server/:server/writeFile', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.writeFile);
        apiRouter.post('/server/:server/removeFile', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.removeFile);
        apiRouter.post('/server/:server/removeFolder', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.removeFolder);
        apiRouter.post('/server/:server/fileContents', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.fileContents);
        apiRouter.post('/server/:server/checkAllowed', [this.authMiddleware.authRequired, this.serverMiddleware.getServer], gameserverController.checkAllowed);
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
