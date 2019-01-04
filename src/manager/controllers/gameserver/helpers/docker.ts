import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

import * as Dockerode from 'dockerode';
import {Status} from "../../../../util/status";
import * as Tail from "tail";
import * as userid from "userid";
import {SSManager} from "../../../../ssmanager";
import {ServerActionError} from "../../../../util/errors/serverActionError";

class DockerHelper extends Helper {

    private readonly dockerController;
    containerShellStream;
    processStdinStream;
    containerLoggerStream;
    container;


    constructor(server: Gameserver) {
        super(server);

        //TODO: may need to add a config option for specificity this manually
        this.dockerController = new Dockerode({
            socketPath: "/var/run/docker.sock"
        });

        this.container = this.dockerController.getContainer(this.server.id);
    }

    /*
    Control
     */
    public rebuild = async () => {
        await this.destroy();
        await this.create();
    };

    public destroy = async () => {
        await this.ensureStopped();

        await this.container.remove();
    };

    public create = async () => {
        let image;
        switch (this.server.currentGame.dockerType) {
            case "Java":
                image = 'ssjava';
                break;
            default:
                throw new ServerActionError("Invalid Docker Type specified in config.");
        }

        //Specify container data
        //Create container and get it all ready
        const newContainer = {
            Image: image,
            name: this.server.id,
            User: userid.uid(this.server.id) + "", //Fix Docker user issue
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            OpenStdin: true,
            Tty: true,
            ExposedPorts: {}, //Fill this in later
            HostConfig: {
                PortBindings: {}, //Fill this in later
                Mounts: [
                    {
                        Target: '/home/container',
                        Source: this.server.fsHelper.getRoot(),
                        Type: 'bind',
                        ReadOnly: false,
                    },
                    {
                        Target: '/opt/ss-static',
                        Source: '/opt/ss-static',
                        Type: 'bind',
                        ReadOnly: true,
                    }

                ],
                Tmpfs: {
                    '/tmp': 'rw,exec,nosuid,size=50M',
                },
                Memory: Math.round(this.server.build.mem * 1000000),
                MemoryReservation: Math.round(this.server.build.mem * 1000000),
                MemorySwap: -1,
                CpuQuota: (this.server.build.cpu > 0) ? this.server.build.cpu * 1000 : -1,
                CpuPeriod: 100000,
                CpuShares: 1024,
                BlkioWeight: this.server.build.io,
                Dns: ['8.8.8.8', '8.8.4.4'],
                LogConfig: {
                    Type: 'json-file',
                    Config: {
                        'max-size': '5m',
                        'max-file': '1',
                    },
                },
                SecurityOpt: ['no-new-privileges'],
                ReadonlyRootfs: true,
                CapDrop: [
                    'setpcap', 'mknod', 'audit_write', 'net_raw', 'dac_override',
                    'fowner', 'fsetid', 'net_bind_service', 'sys_chroot', 'setfcap',
                ],
                OomKillDisable: false,
            },
        };

        //Fill in exposed ports
        newContainer.ExposedPorts[this.server.port + "/tcp"] = {};
        newContainer.ExposedPorts[this.server.port + "/udp"] = {};
        //Fill in port bindings
        newContainer.HostConfig.PortBindings[this.server.port + "/tcp"] = [{
            'HostPort': this.server.port.toString(),
        }];
        newContainer.HostConfig.PortBindings[this.server.port + "/udp"] = [{
            'HostPort': this.server.port.toString(),
        }];

        await this.dockerController.createContainer(newContainer);
    };

    /*
    Misc
     */
    public updateContainer = async () => {
        await this.ensureStopped();

        await this.container.update({
            BlkioWeight: this.server.build.io,
            CpuQuota: (this.server.build.cpu > 0) ? this.server.build.cpu * 1000 : -1,
            CpuPeriod: 100000,
            CpuShares: 1024,
            Memory: Math.round(this.server.build.mem * 1000000),
            MemoryReservation: Math.round(this.server.build.mem * 1000000),
            MemorySwap: -1,

        });
    };

    public writeToProcess = (data: string) => {
        if (!this.processStdinStream)
            return;
        this.processStdinStream.pause();
        this.processStdinStream.write(data + "\n"); //New line is very critical. It cost me like an hour of debugging
        this.processStdinStream.resume();
    };

    /*
    Power functions
     */

    private ensureStopped = async (): Promise<boolean> => {
        const data = await this.container.inspect();
        if (data.State.Status === 'running') {
            await this.server.killContainer(false);
            return true
        }
        return false;
    };

    public startContainer = async () => {
        await this.ensureStopped();

        //Get our container up and running
        await this.container.start();

        //Build the command we're going to use to load the game server
        let startCmd = this.server.currentGame.startCommand.replace(new RegExp('{memory}', 'g'), this.server.build.mem); //Server memory
        startCmd = startCmd.replace(new RegExp('{port}', 'g'), String(this.server.port)); //Server port
        startCmd = startCmd.replace(new RegExp('{players}', 'g'), String(this.server.players)); //Server port

        SSManager.logger.verbose("start command: " + startCmd);

        //Docker start commands
        const dockerOptions = {
            'AttachStdin': true,
            'AttachStdout': true,
            'AttachStderr': true,
            'Tty': true,
            'OpenStdin': true,
            'StdinOnce': false,
            Cmd: ['/bin/bash', '-c', startCmd],
        };
        //Execute commands on container
        let exec = await this.container.exec(dockerOptions);
        //Get the stream created by the process
        this.processStdinStream = (await exec.start({stream: true, stdout: true, stderr: true, stdin: true})).output;
        this.processStdinStream.setEncoding("utf8");

        await this.initContainerShell();
        await this.initFileLog();

        this.processStdinStream.on('end', this.stdinEndListener);
    };

    private stdinEndListener = () => {
        SSManager.logger.verbose("[Server " + this.server.id + "] Processes stream ended.");
        this.server.killContainer();
    };

    public killContainer = async () => {
        //TODO: cant find any docs on alternatives or why this is deprecated.
        await this.container.stop();
    };

    /*
    Logging
     */
    private initFileLog = async () => {
        if (this.server.currentGame.logging.logFile.useLogFile) {
            let hadLogError = false;

            //Get the log file specified
            const filePath = this.server.currentGame.logging.logFile.path;

            //We need to make sure these files exist for logging
            await this.server.fsHelper.ensureFile(filePath);
            await this.server.fsHelper.truncateFile(filePath);

            this.containerLoggerStream = new Tail.Tail(this.server.fsHelper.extendPath(filePath));
            this.containerLoggerStream.on('line', data => {
                this.server.logInfo(data);
            });
            this.containerLoggerStream.on('error', () => {
                if (!hadLogError) {
                    hadLogError = true;
                    this.server.logAnnounce("Failed to find log file for server. You may need to restart to see log messages again.");
                }
            });
        }
    };

    private closeStreams = () => {
        SSManager.logger.verbose("Closing streams");
        if (this.containerLoggerStream)
            this.containerLoggerStream.unwatch();
        this.containerLoggerStream = undefined;

        if (this.containerShellStream)
            this.containerShellStream._output.removeAllListeners();

        this.containerShellStream = undefined;

        if (this.processStdinStream)
            this.processStdinStream.removeAllListeners();

        this.processStdinStream = undefined;
    };

    private initContainerShell = async () => {
        this.containerShellStream = await this.container.attach({
            'Detach': false,
            'Tty': false,
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true
        });

        //This is always enabled
        //LMAO WTF! WHY IS THIS AT _.output AND WHY IS IT NOT DOCUMENTED
        this.containerShellStream._output.on('end', () => {
            SSManager.logger.verbose("[Server " + this.server.id + "] Container stream ended.");
            this.closeStreams();
            this.server.updateStatus(Status.Off);
        }).on('error', (data) => {
            this.server.logAnnounce("Your servers container encountered an error; " + data);
        });

        //Only enabled if specified
        //TODO: this might be brolken
        if (this.server.currentGame.logging.useStdout) {
            this.containerShellStream.on('data', data => {
                this.server.logInfo(data);
            });
        }
    };
}

export {DockerHelper}