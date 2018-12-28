import * as express from 'express'
import {SSManager} from "../ssmanager";
import {ConfigsController} from "../manager/controllers/configs/configManager";
import {GameserverController} from "../manager/controllers/gameserver/gameserverManager";

class APIServer {
    public express;
    public https;
    static io;

    private readonly configsController;
    private readonly serverController;

    constructor(configsController: ConfigsController, serverController: GameserverController) {
        this.express = express();

        this.configsController = configsController;
        this.serverController = serverController;
    }

    private bootstrapExpress = (): void => {
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
    };

    private mountRoutes = (): void => {

    };
}