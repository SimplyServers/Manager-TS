import {SSManager} from "../../../ssmanager";
import {ServerActionError} from "../../../util/errors/serverActionError";
import {Status} from "../../../util/status";
import {IGame} from "../configs/gameConfig";
import {IServer} from "../configs/serverConfig";
import {DockerHelper} from "./helpers/docker";
import {FilesystemHelper} from "./helpers/fs";
import {SocketHelper} from "./helpers/socket";

import * as async from "async";
import * as proc from "child_process";
import {EventEmitter} from "events";
import * as fs from "fs-extra";
import * as path from 'path';
import * as Pty from "pty.js";
import * as sha1file from "sha1-file";
import * as stripAnsi from "strip-ansi";
import * as util from "util";
import {GamedigHelper} from "./helpers/gamedig";

export class Gameserver extends EventEmitter {

    public currentGame: IGame;
    public status: Status;
    public id: string;
    public installedPlugins: any;
    public build: any;
    public port: number;
    public players: number;

    public isBlocked: boolean;
    public isInstalled: boolean;

    public dockerHelper: DockerHelper;
    public socketHelper: SocketHelper;
    public fsHelper: FilesystemHelper;
    public gamedigHelper: GamedigHelper;

    constructor(conf: IServer) {
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
        this.gamedigHelper = new GamedigHelper(this);
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

    public reloadConfig = async (conf: IServer): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }

        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        this.currentGame = conf.game;
        this.players = conf.players;
        this.build = conf.build;
        this.port = conf.port;

        await this.updateConfig();
        await this.dockerHelper.rebuild();
        await this.runUpdateScripts();

        this.setBlocked(false);
    };

    public updateConfig = async (): Promise<void> => {
        await fs.outputJson(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"), this.exportConfig());
    };

    public create = async (password: string): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }
        this.setBlocked(true);
        await new Promise((resolve, reject) => {
            proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/newUser.sh") + " %s %s", this.id, password), (err) => {
                if(err) { return reject(err); }
                else { return resolve(); }
            });
        });
        await this.dockerHelper.create();
        await this.createIdentity();

        this.setBlocked(false);
    };

    public createIdentity = async (): Promise<void> => {
        await fs.outputJson(path.join(this.fsHelper.getRoot(), "/identity.json"), {
            id: this.id
        });
    };

    public start = async (): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }

        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.logAnnounce("Verifying server integrity...");

        // Make sure the sha1 hashes are ok
        // TODO: maybe change from sha1, the risk is literally non-existent, but its good practice
        await Promise.all(this.currentGame.verify.map(async rule => {
            await new Promise((resolve, reject) => {
                sha1file(this.fsHelper.extendPath(rule.path), (err, sha) => {
                    if (err) { return reject(err); }
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

        // Start server
        this.updateStatus(Status.Starting);

        this.gamedigHelper.start();
        await this.dockerHelper.startContainer();
    };

    public executeCommand = (command: string): void => {
        if (this.status !== Status.Running) {
            throw new ServerActionError("Server is not running.");
        }

        if (command === this.currentGame.stopConsoleCommand) {
            this.updateStatus(Status.Stopping);
        }

        this.dockerHelper.writeToProcess(command);
    };

    public removePlugin = async (plugin: string): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }
        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        const pluginData = this.installedPlugins.find(installedData => installedData.name === plugin);
        if (pluginData === undefined) {
            throw new ServerActionError("Plugin not installed.");
        }

        await this.executeShellStack(pluginData.remove);
    };

    public installPlugin = async (plugin: string): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }
        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        const targetPlugin = SSManager.configsController.plugins.find(pluginData => pluginData.name === plugin);
        if (targetPlugin === undefined) {
            throw new ServerActionError("Plugin does not exist.");
        }


        if (targetPlugin.game !== this.currentGame.name) {
            throw new ServerActionError("Plugin not supported.");
        }

        if (this.installedPlugins.find(installedData => installedData.name === plugin) !== undefined) {
            throw new ServerActionError("Plugin already installed.");
        }

        this.installedPlugins.push(targetPlugin);
        await this.updateConfig();

        await this.executeShellStack(targetPlugin.install);

        this.setBlocked(false);
    };

    public changePassword = async (password: string): Promise<void> => {
        // TODO: double check if support is added for SFTP
        // Strip all possible things that might mess this up
        const newPassword = '"' + password.replace(/(["\s'$`\\])/g, '\\$1') + '"';

        await new Promise((resolve, reject) => {
            proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/resetPassword.sh") + " %s %s", this.id, newPassword), (err) => {
                if(err) { return reject(err); }
                else { return resolve(); }
            });
        });

    };

    /*
    WARNING: Do not directly call this, as it will not remove the server from the listing.
     */
    public remove = async (): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }
        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        // If an error occurs here we need to unblock the server
        try {
            await this.dockerHelper.destroy();
        } catch (e) {
            this.setBlocked(false);
            throw new ServerActionError("Failed to remove Docker; " + e);
        }

        await new Promise((resolve, reject) => {
            proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/removeUser.sh") + " %s", this.id), (err) => {
                if(err) { return reject(err); }
                else { return resolve(); }
            });
        });

        await fs.unlink(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"));
    };

    public reinstall = async (): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }
        if (!this.isInstalled) {
            throw new ServerActionError("Install the server instead of reinstalling.");
        }
        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        this.logAnnounce("Reinstalling server...");
        await this.updateConfig();

        this.logAnnounce("Removing old server data...");
        await new Promise((resolve, reject) => {
            proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/clearUser.sh") + " %s", this.id), (err) => {
                if(err) { return reject(err); }
                else { return resolve(); }
            });
        });

        await this.createIdentity();

        this.logAnnounce("Installing server files...");
        await this.runInstallScripts();

        this.logAnnounce("Rebuilding container...");

        // Catch this error so the server doesn't get stuck in blocked mode
        try {
            await this.dockerHelper.rebuild();
        }catch (e) {
            this.setBlocked(false);
            throw new ServerActionError("Failed to remove Docker; " + e);
        }

        this.logAnnounce("Finished reinstalling server. You may now start it!");

        this.setBlocked(false);
    };

    public stop = (): void => {
        if (this.status !== Status.Running) {
            throw new ServerActionError("Server is not running.");
        }
        this.dockerHelper.writeToProcess(this.currentGame.stopConsoleCommand);
        this.updateStatus(Status.Stopping);
    };

    public install = async (): Promise<void> => {
        if (this.isBlocked) {
            throw new ServerActionError("Server is locked. It may be installing or updating.");
        }

        if (this.isInstalled) {
            throw new ServerActionError("Reinstall the server instead of installing.");
        }

        if (this.status !== Status.Off) {
            throw new ServerActionError("Server is not off.");
        }

        this.setBlocked(true);

        this.logAnnounce("Installing server...");
        await this.updateConfig();
        this.logAnnounce("Installing server files...");
        await this.runInstallScripts();
        this.logAnnounce("Finished installing server. You may now start it!");

        this.setBlocked(false);
        await this.setInstalled(true);
    };


    public logInfo = (data: string): void => {
        if (this.status === Status.Starting) {
            this.updateStatus(Status.Running);
        }
        SSManager.logger.verbose("[Server " + this.id + "] " + data);
        this.emit('console', stripAnsi(data));
    };

    public logAnnounce = (data: string): void => {
        SSManager.logger.verbose("[Server " + this.id + "] " + data);
        this.emit('announcement', data);
    };


    public updateStatus = (status: Status): void => {
        SSManager.logger.verbose("Server " + this.id + " status updated to " + status);
        this.status = status;
        this.emit('statusChange', status);
    };

    /*
    This will throw an exception if the server is not running.
     */
    public forceKill = async (): Promise<void> => {
        if (this.status === Status.Off) {
            throw new ServerActionError("Server is not running.");
        }

        await this.killContainer();
    };

    /*
    This won't, so use it internally.
     */
    public killContainer = async (updateStatus: boolean = true): Promise<void> => {
        if(updateStatus) {
            this.updateStatus(Status.Stopping);
        }

        if (this.status !== Status.Off) {
            this.gamedigHelper.stop();
            await this.dockerHelper.killContainer();
        }
    };

    private runUpdateScripts = async (): Promise<void> => {
        const updateCommands = this.currentGame.update;
        await this.executeShellStack(updateCommands);
    };

    private runInstallScripts = async (): Promise<void> => {
        const installCommands = this.currentGame.install;
        await this.executeShellStack(installCommands);
    };

    private setBlocked = (isBlocked: boolean): void => {
        SSManager.logger.verbose("[Server " + this.id + " ] Blocked set to " + isBlocked);
        this.isBlocked = isBlocked;
        this.emit('block', isBlocked);
    };

    private setInstalled = async (isInstalled: boolean): Promise<void> => {
        this.isInstalled = isInstalled;
        this.emit('installed', isInstalled);
        await this.updateConfig();
    };

    private executeShellStack = async (stack: any): Promise<void> => {
        await new Promise((resolve) => {
            async.forEachSeries(stack, (cmd: any, next) => {
                const shell = 'su';
                const params = [
                    '-s',
                    '/bin/bash',
                    '-l',
                    this.id,
                    '-c',
                    'cd ' + this.fsHelper.getRoot() + ' && ' + cmd.command
                ];
                const installerProcess = Pty.spawn(shell, params);
                installerProcess.on('exit', () => {
                    next()
                });

            }, () => {
                return resolve();
            });
        });
    }
}