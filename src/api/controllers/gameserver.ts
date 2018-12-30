import {ValidationError} from "../../util/errors/validationError";
import {ServerActionError} from "../../util/errors/serverActionError";
import {SSManager} from "../../ssmanager";

import * as async from "async";

class ServersController {
    public getGameservers = async (req, res, next) => {
        const serverList = [];

        SSManager.serverController.servers.map(server => {
           serverList.push(server.getInfo());
        });

        res.json({servers: serverList })
    };

    public getServer = async (req, res, next) => {
        res.json({server: req.server.getInfo()})
    };

    public resetPassword = async (req, res, next) => {
        const data = req.body;

        //Validate inputs
        if (data.password === undefined) {
            return next(new ValidationError('password'));
        } else if (!/\S/.test(data.password)) {
            return next(new ValidationError('password'));
        }

        try {
            await req.server.changePassword(data.password);
        } catch (e) {
            return next(e);
        }
    };

    public writeFile = async (req, res, next) => {
        const data = req.body;

        //Validate inputs
        if (data.path === undefined) {
            return next(new ValidationError('path'));
        } else if (data.contents === undefined) {
            return next(new ValidationError('contents'));
        } else if (!/\S/.test(data.path)) {
            return next(new ValidationError('path'));
        } else if (!/\S/.test(data.contents)) {
            return next(new ValidationError('contents'));
        }

        try {
            await req.server.fsHelper.writeFile(data.path, data.contents);
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public removeFile = async (req, res, next) => {
        const data = req.body;

        //Validate inputs
        if (data.path === undefined) {
            return next(new ValidationError('path'));
        } else if (!/\S/.test(data.path)) {
            return next(new ValidationError('path'));
        }

        try {
            await req.server.fsHelper.removeFile(data.path);
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public fileContents = async (req, res, next) => {
        const data = req.body;

        //Validate inputs
        if (data.path === undefined) {
            return next(new ValidationError('path'));
        } else if (!/\S/.test(data.path)) {
            return next(new ValidationError('path'));
        }

        let contents;
        try {
            contents = await req.server.fsHelper.getFileContents(data.path);
        } catch (e) {
            return next(e);
        }

        res.json({contents: contents});
    };

    public getDir = async (req, res, next) => {
        const data = req.body;

        //Validate inputs
        if (data.path === undefined) {
            return next(new ValidationError('path'));
        } else if (!/\S/.test(data.path)) {
            return next(new ValidationError('path'));
        }

        let contents;
        try {
            contents = await req.server.fsHelper.getDir(data.path);
        } catch (e) {
            return next(e);
        }

        res.json({contents: contents});
    };

    public execute = async (req, res, next) => {
        const data = req.body;

        if (data.command === undefined) {
            return next(new ValidationError('command'));
        } else if (!/\S/.test(data.command)) {
            return next(new ValidationError('command'));
        }

        try {
            await req.server.executeCommand(data.command);
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public power = async (req, res, next) => {
        try {
            switch (req.params.power) {
                case 'on':
                    await req.server.start();
                    break;
                case 'off':
                    await req.server.stop();
                    break;
                case 'kill':
                    await req.server.forceKill();
                    break;
                default:
                    return next(new ServerActionError("Invalid power action."))
            }
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public reinstall = async (req, res, next) => {
        try {
            await req.server.reinstall();
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public edit = async (req, res, next) => {
        const data = req.body;

        if (data.config === undefined) {
            return next(new ValidationError('config'));
        } else if (!/\S/.test(data.config)) {
            return next(new ValidationError('config'));
        }

        //Get the servers current config
        let config = req.server.exportConfig();

        //Parse the new config as JSON
        let givenConfig;
        try {
            givenConfig = JSON.parse(req.body.config);
        } catch (e) {
            return next(new ValidationError("givenConfig"));
        }

        //Check if it contains a build
        if (givenConfig.build) {
            //Verify build json
            let build = givenConfig.build;
            if (build.io === undefined || build.cpu === undefined || build.mem === undefined) {
                return next(new ValidationError("Invalid build layout."));
            }
            config.build.io = build.io;
            config.build.cpu = build.cpu;
            config.build.mem = build.mem;
        }

        //Check for port
        if (givenConfig.port) {
            config.port = givenConfig.port;
        }
        //Check for maxplayers
        if (givenConfig.players) {
            config.players = givenConfig.players;
        }

        //Check for game
        if (givenConfig.game) {
            const gameJson = SSManager.configsController.games.find(game => game.name === givenConfig.game);
            if (gameJson === undefined)
                return next(new ValidationError("game"));
            config.game = gameJson;
        }

        try {
            await req.server.reloadConfig(config);
        } catch (e) {
            return next(e);
        }

        res.json({});
    }

    public update = async (req, res, next) => {
        try {
            await req.server.runUpdateScripts();
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public install = async (req, res, next) => {
        try {
            await req.server.install();
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public remove = async (req, res, next) => {
        let removed;
        try {
            removed = await SSManager.serverController.removeServer(req.server);
        } catch (e) {
            return next(e);
        }

        if(!removed)
            return next(new ValidationError("server"));

        res.json({});
    };

    public removePlugin = async (req, res, next) => {
        const data = req.body;

        if (data.plugin === undefined) {
            return next(new ValidationError('plugin'));
        } else if (!/\S/.test(data.plugin)) {
            return next(new ValidationError('plugin'));
        }

        try {
            await req.server.removePlugin(data.plugin);
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public installPlugin = async (req, res, next) => {
        const data = req.body;

        if (data.plugin === undefined) {
            return next(new ValidationError('plugin'));
        } else if (!/\S/.test(data.plugin)) {
            return next(new ValidationError('plugin'));
        }

        try {
            await req.server.installPlugin(data.plugin);
        } catch (e) {
            return next(e);
        }

        res.json({});
    };

    public getPlugins = async (req, res) => {
        res.json({
            plugins: req.server.installedPlugins
        });
    };

    public add = async (req, res, next) => {
        const data = req.body;

        if (data.config === undefined) {
            return next(new ValidationError('config'));
        } else if (!/\S/.test(data.config)) {
            return next(new ValidationError('config'));
        } else if (data.password === undefined) {
            return next(new ValidationError('password'));
        } else if (!/\S/.test(data.password)) {
            return next(new ValidationError('password'));
        }

        let config;
        try {
            config = JSON.parse(data.config);
        } catch (e) {
            return next(new ValidationError("config"));
        }

        //Verify config json
        if (config.id === undefined || config.game === undefined || config.port === undefined || config.build === undefined || config.players === undefined) {
            return next(new ValidationError("config"));
        }

        //Verify build json
        let build = config.build;
        if (build.io === undefined || build.cpu === undefined || build.mem === undefined) {
            return next(new ValidationError("build"));
        }

        //Verify players
        let players = config.players;
        try{
            players = Number.parseInt(players);
        }catch (e) {
            return next(new ValidationError("config"));
        }

        config.players = players;

        const checkPort = (port) => {
            return SSManager.serverController.servers.find(server => server.port === port) === undefined;
        };

        if (config.port === -1) {
            let currentPort = SSManager.config.servers.minPort;
            const maxPort = SSManager.config.servers.maxPort;

            let found = false;
            try {
                await new Promise((resolve, reject) => {
                    async.whilst(() => {
                        if (currentPort <= maxPort) {
                            return !found;
                        } else {
                            return false;
                        }
                    }, (next) => {
                        if (checkPort(currentPort)) {
                            found = true;
                        } else {
                            currentPort++;
                        }
                        next();
                    }, () => {
                        if (found === false) {
                            return reject(new ServerActionError("All ports in use"));
                        }
                        config.port = currentPort;
                        return resolve();
                    })
                });
            } catch (e) {
                return next(e);
            }
        } else {
            if (!checkPort(config.port)) {
                return next(new ServerActionError("Port in use"));
            }
        }

        //Replace the game text with the actual game json. So, config.game = "Minecraft Spigot 1.13.1" would become the entire json of the game.
        let gameJson = SSManager.configsController.games.find(game => game.name === config.game);

        if (gameJson === undefined)
            return next(new ValidationError("game"));

        config.game = gameJson;

        //Check to make sure the server doesn't already exist.
        if(SSManager.serverController.servers.find(server => server.id === config.id) !== undefined)
            return next(new ServerActionError("Server already exists."));

        config.installed = false; //Server has not been installed
        config.plugins = []; //Plugins start out empty.

        let newServer;
        try {
            newServer = await SSManager.serverController.addNewServer(config);
        } catch (e) {
            return next(e);
        }

        await newServer.create();

        res.json({
            server: newServer.getInfo()
        });
    }
}

export {ServersController}