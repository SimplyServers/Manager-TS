import {ConfigsController} from "./manager/controllers/configs/configManager";
import {Logger} from './util/logger';
import {Gameserver} from "./manager/controllers/gameserver/gameserver";
import {DockerTypes} from "./util/dockerTypes";
import {IConfig} from "./util/config";

import * as configData from "../config.json";
import {GameserverController} from "./manager/controllers/gameserver/gameserverManager";

class SSManager {
    static config: IConfig;
    static logger: Logger;

    private configsController;
    private serverController;

    constructor() {
        SSManager.logger = new Logger(false);
        SSManager.config = configData;

        SSManager.logger.info("Starting bootstrap...");
        this.bootstrap().then(() => {
            SSManager.logger.info("Bootstrap finished.");
        }).catch((err) => {
            SSManager.logger.error("Failed to bootstrap; " + err)
        })
    }

    private bootstrap = async () => {
        //Bootstrap configs
        this.configsController = new ConfigsController("../storage/");
        SSManager.logger.info("Loading games...");
        await this.configsController.loadGames();
        SSManager.logger.info("Loading plugins...");
        await this.configsController.loadPlugins();

        //Bootstrap servers
        this.serverController = new GameserverController("../storage/");
        SSManager.logger.info("Loading servers...");
        await this.serverController.loadServers();

        //Load API


        //TODO: remove when done plz
        const debugServer = new Gameserver({
            id: "testing",
            game: {
                name: "Minecraft",
                gamedig: {
                    active: true,
                    id: "minecraft"
                },
                install: [
                    {
                        type: "shellCommand",
                        command: "wget https://cdn.getbukkit.org/spigot/spigot-1.13.1.jar"
                    },
                    {
                        type: "shellCommand",
                        command: "mv spigot-1.13.1.jar server.jar"
                    },
                    {
                        type: "shellCommand",
                        command: "echo 'eula=true' > eula.txt"
                    }
                ],
                update: [
                    {
                        type: "shellCommand",
                        command: "rm server.jar"
                    },
                    {
                        type: "shellCommand",
                        command: "wget https://cdn.getbukkit.org/spigot/spigot-1.13.1.jar"
                    },
                    {
                        type: "shellCommand",
                        command: "mv spigot-1.13.1.jar server.jar"
                    }
                ],
                startCommand: "java -jar -Xms{memory}M -Xmx{memory}M server.jar -port {port} -s {players}",
                stopConsoleCommand: "stop",
                dockerType: DockerTypes.Java,
                logging: {
                    logFile: {
                        useLogFile: true,
                        path: "logs/latest.log"
                    },
                    useStdout: false
                },
                verify: [
                    {
                        path: "server.jar",
                        sha1: "71c8491dad1f5c5d94104f50383f7265d70f974a"
                    }
                ]

            },
            port: 25565,
            build: {
                io: 0,
                cpu: 0,
                mem: 1000
            },
            plugins: [],
            installed: false,
            players: 5
        });

        try {
            //SSManager.logger.verbose("Create");
            //await debugServer.create("testing123");
            SSManager.logger.verbose("Install");
            await debugServer.install();
            SSManager.logger.verbose("Start");
            await debugServer.start();
        }catch (e) {
            console.log(e);
        }
    };

    static getRoot(): string {
        return __dirname;
    }
}

export {SSManager}