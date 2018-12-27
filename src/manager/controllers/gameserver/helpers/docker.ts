import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

import * as Dockerode from 'dockerode';
import {Stream} from "stream";

class DockerHelper extends Helper {

    private readonly dockerContoller;
    private containerShell: Stream;
    private containerProcessStream: Stream;
    private containerLoggerStream: Stream;
    private container;

    constructor(server: Gameserver) {
        super(server);

        //TODO: may need to add a config option for specificity this manually
        this.dockerContoller = new Dockerode({
            socketPath: "/var/run/docker.sock"
        });

        this.container = this.dockerContoller.getContainer(this.server.id);
    }

    /*
    Power functions
     */

    private ensureStopped = async (): Promise<boolean> => {
        const data = await this.container.inspect();
        if (data.State.Status === 'running') {
            await this.server.forceKillContainer();
            return true
        }
        return false;
    };

    private startContainer = async () => {
        //Get our container up and running
        await this.container.start();

        //Build the command we're going to use to load the game server
        let startCmd = this.server.currentGame.startCommand.replace(new RegExp('{memory}', 'g'), this.server.build.mem); //Server memory
        startCmd = startCmd.replace(new RegExp('{port}', 'g'), String(this.server.port)); //Server port
        startCmd = startCmd.replace(new RegExp('{players}', 'g'), String(this.server.players)); //Server port

        //Docker start commands
        const dockerOptions = {
            'AttachStdin': true,
            'AttachStdout': true,
            'AttachStderr': true,
            'Tty': true,
            'OpenStdin': true,
            'StdinOnce': false,
            Cmd: ['/bin/bash', '-c', startCmd],
        }


    };

    killContainer = async () => {
        //TODO: cant find any docs on alternatives or why this is deprecated.
        this.container.stop();
    };

    /*
    Misc
     */
    private prepareLogging = async () => {

    }
}

export {DockerHelper}