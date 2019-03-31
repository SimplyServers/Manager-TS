import { SSManager } from "../../../SSManager";
import { ServerActionError } from "../../../util/errors/ServerActionError";
import { Status } from "../../../util/Status";
import { IGame } from "../configs/IGame";
import { IServer } from "../configs/IServer";
import { DockerHelper } from "./helpers/DockerHelper";
import { FilesystemHelper } from "./helpers/FilesystemHelper";
import { SocketHelper } from "./helpers/SocketHelper";

import * as async from "async";
import * as proc from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs-extra";
import * as Pty from "node-pty";
import * as path from "path";
import * as sha1file from "sha1-file";
import * as stripAnsi from "strip-ansi";
import * as util from "util";
import { GamedigHelper } from  "./helpers/GamedigHelper";

export class GameServer extends EventEmitter {

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
      throw new ServerActionError("SERVER_LOCKED");
    }

    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
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
      throw new ServerActionError("SERVER_LOCKED");
    }
    this.setBlocked(true);
    await new Promise((resolve, reject) => {
      proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/newUser.sh") + " %s %s", this.id, password), (err) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve();
        }
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
      throw new ServerActionError("SERVER_LOCKED");
    }

    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
    }

    this.logAnnounce("Verifying server integrity...");

    // Make sure the sha1 hashes are ok
    // TODO: maybe change from sha1, the risk is literally non-existent, but its good practice
    await Promise.all(this.currentGame.verify.map(async rule => {
      await new Promise((resolve, reject) => {
        sha1file(this.fsHelper.extendPath(rule.path), (err, sha) => {
          if (err) {
            return reject(err);
          }
          else {
            if (sha === rule.sha1) {
              return resolve();
            } else {
              return reject(new ServerActionError("REINSTALL"));
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
      throw new ServerActionError("SERVER_NOT_RUNNING");
    }

    if (command === this.currentGame.stopConsoleCommand) {
      this.updateStatus(Status.Stopping);
    }

    this.dockerHelper.writeToProcess(command);
  };
  public removePlugin = async (plugin: string): Promise<void> => {
    if (this.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }
    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
    }

    this.setBlocked(true);

    const pluginData = this.installedPlugins.find(installedData => installedData.name === plugin);
    if (pluginData === undefined) {
      throw new ServerActionError("PLUGIN_NOT_INSTALLED");
    }

    await this.executeShellStack(pluginData.remove);
  };
  public installPlugin = async (plugin: string): Promise<void> => {
    if (this.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }
    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
    }

    this.setBlocked(true);

    const targetPlugin = SSManager.configsController.plugins.find(pluginData => pluginData.name === plugin);
    if (targetPlugin === undefined) {
      throw new ServerActionError("INVALID_PLUGIN");
    }


    if (targetPlugin.game !== this.currentGame.name) {
      throw new ServerActionError("PLUGIN_NOT_SUPPORTED");
    }

    if (this.installedPlugins.find(installedData => installedData.name === plugin) !== undefined) {
      throw new ServerActionError("PLUGIN_INSTALLED");
    }

    this.installedPlugins.push(targetPlugin);
    await this.updateConfig();

    await this.executeShellStack(targetPlugin.install);

    this.setBlocked(false);
  };
  public changePassword = async (password: string): Promise<void> => {
    // TODO: double check if support is added for SFTP
    // Strip all possible things that might mess this up
    const newPassword = "\"" + password.replace(/(["\s'$`\\])/g, "\\$1") + "\"";

    await new Promise((resolve, reject) => {
      proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/resetPassword.sh") + " %s %s", this.id, newPassword), (err) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve();
        }
      });
    });

  };
  /*
  WARNING: Do not directly call this, as it will not remove the server from the listing.
   */
  public remove = async (): Promise<void> => {
    if (this.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }
    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
    }

    this.setBlocked(true);

    // If an error occurs here we need to unblock the server
    try {
      await this.dockerHelper.destroy();
    } catch (e) {
      this.setBlocked(false);
      throw new ServerActionError("FAILED_TO_REMOVE_DOCKER");
    }

    await new Promise((resolve, reject) => {
      proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/removeUser.sh") + " %s", this.id), (err) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve();
        }
      });
    });

    await fs.unlink(path.join(SSManager.getRoot(), "../storage/servers/", this.id + ".json"));
  };
  public reinstall = async (): Promise<void> => {
    if (this.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }
    if (!this.isInstalled) {
      throw new ServerActionError("INSTALL_INSTEAD");
    }
    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
    }

    this.setBlocked(true);

    this.logAnnounce("Reinstalling server...");
    await this.updateConfig();

    this.logAnnounce("Removing old server data...");
    await new Promise((resolve, reject) => {
      proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/clearUser.sh") + " %s", this.id), (err) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve();
        }
      });
    });

    await this.createIdentity();

    this.logAnnounce("Installing server files...");
    await this.runInstallScripts();

    this.logAnnounce("Rebuilding container...");

    // Catch this error so the server doesn't get stuck in blocked mode
    try {
      await this.dockerHelper.rebuild();
    } catch (e) {
      this.setBlocked(false);
      throw new ServerActionError("FAILED_TO_INSTALL_DOCKER");
    }

    this.logAnnounce("Finished reinstalling server. You may now start it!");

    this.setBlocked(false);
  };
  public stop = (): void => {
    if (this.status !== Status.Running) {
      throw new ServerActionError("SERVER_NOT_RUNNING");
    }
    this.dockerHelper.writeToProcess(this.currentGame.stopConsoleCommand);
    this.updateStatus(Status.Stopping);
  };
  public install = async (): Promise<void> => {
    if (this.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    if (this.isInstalled) {
      throw new ServerActionError("REINSTALL_INSTEAD");
    }

    if (this.status !== Status.Off) {
      throw new ServerActionError("SERVER_NOT_OFF");
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
    this.emit("console", stripAnsi(data));
  };
  public logAnnounce = (data: string): void => {
    SSManager.logger.verbose("[Server " + this.id + "] " + data);
    this.emit("announcement", data);
  };
  public updateStatus = (status: Status): void => {
    SSManager.logger.verbose("Server " + this.id + " status updated to " + status);
    this.status = status;
    this.emit("statusChange", status);
  };
  /*
  This will throw an exception if the server is not running.
   */
  public forceKill = async (): Promise<void> => {
    if (this.status === Status.Off) {
      throw new ServerActionError("SERVER_NOT_RUNNING");
    }

    await this.killContainer();
  };
  /*
  This won't, so use it internally.
   */
  public killContainer = async (updateStatus: boolean = true): Promise<void> => {
    if (updateStatus) {
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
    this.emit("block", isBlocked);
  };
  private setInstalled = async (isInstalled: boolean): Promise<void> => {
    this.isInstalled = isInstalled;
    this.emit("installed", isInstalled);
    await this.updateConfig();
  };
  private executeShellStack = async (stack: any): Promise<void> => {
    await new Promise((resolve) => {
      async.forEachSeries(stack, (cmd: any, next) => {
        const shell = "su";
        const params = [
          "-s",
          "/bin/bash",
          "-l",
          this.id,
          "-c",
          "cd " + this.fsHelper.getRoot() + " && " + cmd.command
        ];
        // Typings are incorrect.
        // Look at https://github.com/Microsoft/node-pty/blob/master/src/index.ts and https://github.com/Microsoft/node-pty/blob/master/typings/node-pty.d.ts
        // @ts-ignore
        const installerProcess = Pty.spawn(shell, params);
        installerProcess.on("exit", () => {
          next();
        });

      }, () => {
        return resolve();
      });
    });
  };

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
}
