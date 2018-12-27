import EventEmitter = NodeJS.EventEmitter;
import {Status} from "../../../util/status";
import {DockerHelper} from "./helpers/docker";
import {SocketHelper} from "./helpers/socket";
import {IServer} from "../configs/serverConfig";
import {FilesystemHelper} from "./helpers/fs";
import {IGame} from "../configs/gameConfig";

import * as fs from "fs-extra";
import * as path from 'path';
import {SSManager} from "../../../server";
import {ServerActionError} from "../../../util/errors/serverActionError";
import * as proc from "child_process";
import * as util from "util";

class Gameserver extends EventEmitter{

    currentGame: IGame;
    status: Status;
    id: string;
    installedPlugins: any;
    build: any;
    port: number;
    players: number;

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

    public exportConfig = (): IServer => {
        return({
            game: this.currentGame,
            id: this.id,
            port: this.port,
            build: {
                io: this.build.io,
                cpu: this.build.cpu,
                mem: this.build.mem
            },
            plugins: this.installedPlugins,
            installed: this.isInstalled,
            players: this.players
        });
    };

    public getInfo = (): any => {
        return {
            id: this.id,
            port: this.port,
            build: this.build,
            game: this.currentGame,
            plugins: this.installedPlugins,
            installed: this.isInstalled,
            players: this.players,
            status: this.status,
            blocked: this.isBlocked
        };
    };

    public updateConfig = async () => {
        await fs.outputJson(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"), this.exportConfig());
    };

    public create = async (password: string) => {
        if(this.isBlocked)
            throw new ServerActionError("Server is blocked.");
        this.setBlocked(true);
        await proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/newUser.sh") + " %s %s", this.id, password));
        await this.dockerHelper.create();
        await this.createIdentity();
        this.setBlocked(false);
    };

    public createIdentity = async () => {
        await fs.outputJson(path.join(this.fsHelper.getRoot(), "/identity.json"), {
            id: this.id
        });
    };

    public logInfo = (data:string) => {
        if(this.status === Status.Starting)
            this.updateStatus(Status.Running);

    };

    public logAnnounce = (data:string) => {

    };


    public updateStatus = (status: Status) => {
        this.status = status;
    };

    private setBlocked = (isBlocked: boolean) => {
        this.isBlocked = isBlocked;
    };

    private setInstalled = (isInstalled: boolean) => {
        this.isInstalled = isInstalled;
    };

    public forceKillContainer = async () => {
        this.updateStatus(Status.Stopping);
        await this.dockerHelper.killContainer();
        this.updateStatus(Status.Off);
    };

    public startContainer = async () => {
        this.updateStatus(Status.Starting);
        await this.dockerHelper.startContainer();
    };
}

export { Gameserver }