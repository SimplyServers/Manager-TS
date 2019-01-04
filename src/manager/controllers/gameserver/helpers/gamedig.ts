import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

import * as gamedig from "gamedig";
import {Status} from "../../../../util/status";
import {SSManager} from "../../../../ssmanager";

class GamedigHelper extends Helper {

    pingerInterval;
    failedPings: number;
    enabled: boolean;

    constructor(server: Gameserver) {
        super(server);
        this.failedPings = 0;
        this.enabled = false;
    }

    public start = () => {
        this.enabled = true;
        this.pingerInterval = setInterval(this.pinger, SSManager.config.servers.pingTime);
    };

    public stop = () => {
        this.failedPings = 0;
        this.enabled = false;
        if (this.pingerInterval)
            clearInterval(this.pingerInterval);
    };

    private pinger = () => {
        if (!this.enabled || this.server.status === Status.Off) {
            this.stop();
            return;
        }

        SSManager.logger.verbose("[Server " + this.server.id + "] Pinging for gamedig ID: " + this.server.currentGame.gamedig.id + " @ port " + this.server.port);

        gamedig.query({
            type: this.server.currentGame.gamedig.id,
            host: "127.0.0.1",
            port: this.server.port
        }).then(() => {
            SSManager.logger.verbose("Ping OK");
            this.failedPings = 0;
        }).catch(() => {
            SSManager.logger.verbose("Ping failed");
            if (this.failedPings >= 3) {
                if (this.server.status !== Status.Off)
                    this.server.killContainer().then(() => {
                        this.failedPings = 0;
                        this.server.logAnnounce("Your server has been killed due to a detected crash.")
                    });
            } else {
                this.failedPings++;
            }
        })
    };

}

export {GamedigHelper}