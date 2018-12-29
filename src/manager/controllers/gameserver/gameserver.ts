import {Status} from "../../../util/status";
import {DockerHelper} from "./helpers/docker";
import {SocketHelper} from "./helpers/socket";
import {IServer} from "../configs/serverConfig";
import {FilesystemHelper} from "./helpers/fs";
import {IGame} from "../configs/gameConfig";

import * as fs from "fs-extra";
import * as path from 'path';
import {SSManager} from "../../../ssmanager";
import {ServerActionError} from "../../../util/errors/serverActionError";
import * as proc from "child_process";
import * as util from "util";
import * as async from "async";
import * as sha1file from "sha1-file";
import {EventEmitter} from "events";
import * as Pty from "pty.js";
import {ConfigsController} from "../configs/configManager";

class Gameserver extends EventEmitter {

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

    private readonly configsController: ConfigsController;

    constructor(conf: IServer, configsController: ConfigsController) {
        super();

        this.currentGame = conf.game;
        this.id = conf.id;
        this.players = conf.players;
        this.build = conf.build;
        this.isInstalled = conf.installed;
        this.installedPlugins = conf.plugins;
        this.port = conf.port;

        this.isBlocked = false;
        this.status = Status.Off;

        this.dockerHelper = new DockerHelper(this);
        this.socketHelper = new SocketHelper(this);
        this.fsHelper = new FilesystemHelper(this);

        this.configsController = configsController;
    }

    public exportConfig = (): IServer => {
        return ({
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

    public reloadConfig = async (conf: IServer) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        this.currentGame = conf.game;
        this.players = conf.players;
        this.build = conf.build;
        this.port = conf.port;

        await this.updateConfig();
        await this.dockerHelper.rebuild();
        await this.runUpdateScripts(false);

        this.setBlocked(false);
    };

    public updateConfig = async () => {
        await fs.outputJson(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"), this.exportConfig());
    };

    public create = async (password: string) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
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

    private runUpdateScripts = async (updateBlock: boolean = true) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        if(updateBlock)
            this.setBlocked(true);
        const updateCommands = this.currentGame.update;
        await this.executeShellStack(updateCommands);

        if(updateBlock)
            this.setBlocked(false);
    };

    private runInstallScripts = async (updateBlock: boolean = true) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        if(updateBlock)
            this.setBlocked(true);
        const installCommands = this.currentGame.install;
        await this.executeShellStack(installCommands);

        if(updateBlock)
            this.setBlocked(false);
    };

    public start = async () => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");
        this.logAnnounce("Verifying server integrity...");

        //Make sure the sha1 hashes are ok
        //TODO: maybe change from sha1, the risk is literally non-existent, but its good practice
        await Promise.all(this.currentGame.verify.map(async rule => {
            await new Promise((resolve, reject) => {
                sha1file(this.fsHelper.extendPath(rule.path), (err, sha) => {
                    if (err) return reject(err);
                    else {
                        if (sha === rule.sha1) {
                            return resolve();
                        } else {
                            return reject(new ServerActionError("Reinstall your server."));
                        }
                    }
                });
            });
        }));

        this.logAnnounce("Server files checked out.");
        this.logAnnounce("Bootstrapping server...");

        //Start server
        this.updateStatus(Status.Starting);
        await this.dockerHelper.startContainer();
    };

    public executeCommand = (command: string) => {
        if (this.status !== Status.Running)
            throw new ServerActionError("Server is not running.");

        if (command === this.currentGame.stopConsoleCommand)
            this.updateStatus(Status.Stopping);

        this.dockerHelper.writeToProcess(command);
    };

    public removePlugin = async (plugin: string) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        const pluginData = this.installedPlugins.find(installedData => installedData.name === plugin);
        if (pluginData === undefined)
            throw new ServerActionError("Plugin not installed.");

        await this.executeShellStack(pluginData.remove);
    };

    public installPlugin = async (plugin: string) => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        const targetPlugin = this.configsController.plugins.find(pluginData => pluginData.name === plugin);
        if (targetPlugin === undefined)
            throw new ServerActionError("Plugin does not exist.");

        if(targetPlugin.game !== this.currentGame.name)
            throw new ServerActionError("Plugin not supported.");

        if(this.installedPlugins.find(installedData => installedData.name === plugin) !== undefined)
            throw new ServerActionError("Plugin already installed.");

        this.installedPlugins.push(targetPlugin);
        await this.updateConfig();

        await this.executeShellStack(targetPlugin.install);

        this.setBlocked(false);
    };

    public changePassword = async (password: string) => {
        //TODO: double check if support is added for SFTP
        //Strip all possible things that might mess this up
        const newPassword = '"' + password.replace(/(["\s'$`\\])/g, '\\$1') + '"';

        await proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/resetPassword.sh") + " %s %s", this.id, password));
    };

    /*
    WARNING: Do not directly call this, as it will not remove the server from the listing.
     */
    public remove = async () => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        //If an error occurs here we need to unblock the server
        try {
            await this.dockerHelper.destroy();
        }catch (e) {
            this.setBlocked(false);
            throw new ServerActionError("Failed to remove Docker; " + e);
        }

        await proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/removeUser.sh") + " %s", this.id));
        await fs.unlink(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"));
    };

    public reinstall = async () => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (!this.isInstalled)
            throw new ServerActionError("Install the server instead of reinstalling.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        this.logAnnounce("Reinstalling server...");
        await this.updateConfig();

        this.logAnnounce("Removing old server data...");
        await proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/cleanUser.sh") + " %s", this.id));
        await this.createIdentity();

        this.logAnnounce("Installing server files...");
        await this.runInstallScripts();

        this.logAnnounce("Rebuilding container...");
        await this.dockerHelper.rebuild();

        this.logAnnounce("Finished reinstalling server. You may now start it!");

        this.setBlocked(false);
    };

    public stop = async () => {
        if (this.status !== Status.Running)
            throw new ServerActionError("Server is not running.");
        this.dockerHelper.writeToProcess(this.currentGame.stopConsoleCommand);
        this.updateStatus(Status.Stopping);
    };

    public install = async () => {
        if (this.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        if (this.isInstalled)
            throw new ServerActionError("Reinstall the server instead of installing.");
        if (this.status !== Status.Off)
            throw new ServerActionError("Server is not off.");

        this.setBlocked(true);

        this.logAnnounce("Installing server...");
        await this.updateConfig();
        this.logAnnounce("Installing server files...");
        await this.runInstallScripts();
        this.logAnnounce("Finished installing server. You may now start it!");

        this.setBlocked(false);
        this.setInstalled(true);
    };


    public logInfo = (data: string) => {
        if (this.status === Status.Starting)
            this.updateStatus(Status.Running);
        SSManager.logger.verbose("[Server " + this.id + "] " + data);
    };

    public logAnnounce = (data: string) => {
        SSManager.logger.verbose("[Server " + this.id + "] " + data);
    };


    public updateStatus = (status: Status) => {
        SSManager.logger.verbose("Server " + this.id + " status updated to " + status);
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

    private executeShellStack = async (stack: any) => {
        await new Promise((resolve) => {
            SSManager.logger.verbose("Stack: " + stack);
            async.forEachSeries(stack, (cmd: any, next) => {
                let shell = 'su';
                let params = [
                    '-s',
                    '/bin/bash',
                    '-l',
                    this.id,
                    '-c',
                    'cd ' + this.fsHelper.getRoot() + ' && ' + cmd.command
                ];
                let installerProcess = Pty.spawn(shell, params);
                installerProcess.on('exit', () => {
                    next()
                });

            }, () => {
                return resolve();
            });
        });
    }
}

export {Gameserver}