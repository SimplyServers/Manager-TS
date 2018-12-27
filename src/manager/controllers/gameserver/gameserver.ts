import EventEmitter = NodeJS.EventEmitter;
import {Status} from "../../../util/status";
import {DockerHelper} from "./helpers/docker";
import {SocketHelper} from "./helpers/socket";
import {IServer} from "../configs/serverConfig";
import {FilesystemHelper} from "./helpers/fs";
import {IGame} from "../configs/gameConfig";

class Gameserver extends EventEmitter{

    currentGame: IGame;
    status: Status;
    id: string;
    installedPlugins: any;
    build: any;
    port: Number;
    players: Number;

    isBlocked: boolean;
    isInstalled: boolean;

    dockerHelper: DockerHelper;
    socketHelper: SocketHelper;
    fsHelper: FilesystemHelper;

    constructor(conf: IServer){
        super();

        this.currentGame = conf.game;
        this.id = conf.id;
        this.players = conf.plugins;
        this.build = conf.build;
        this.isInstalled = conf.installed;
        this.installedPlugins = conf.plugins;
        this.port = conf.port;

        this.isBlocked = false;
        this.status = Status.Off;
    }

    public updateStatus = (status: Status) => {
        this.status = status;
    };

    public forceKillContainer = async () => {
        this.updateStatus(Status.Stopping);
        await this.dockerHelper.killContainer();
        this.updateStatus(Status.Off);
    };

    public startContainer = async () => {
        this.updateStatus(Status.Starting);
        //await this.dockerHelper.startContainer();
    };
}

export { Gameserver }