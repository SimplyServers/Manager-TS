import {Helper} from "./helper";
import {Gameserver} from "../gameserver";
import {SSManager} from "../../../../ssmanager";

class SocketHelper extends Helper {

    private websocket: any;

    constructor(server: Gameserver) {
        super(server);

        this.websocket = SSManager.APIServer.io.of("/server/" + this.server.id);
        this.bootstrapSocket();
    }

    private onStatusChange = (data) => {
      this.websocket.emit('statusUpdate', data);
    };

    private onAnnouncement = (data) => {
        this.websocket.emit('announcement', data);
    };

    private onBlock = (data) => {
        this.websocket.emit('block', data);
    };

    private onInstalled = (data) => {
        this.websocket.emit('installed', data);
    };

    private onConsole = (data) => {
        data = data.toString();
        if ((data.replace(/\s+/g, '')).length > 1) {
            this.websocket.emit('console', {
                'line': data.replace(/\r\n/g, '') + '\n'
            });
        }
    };

    private bootstrapSocket = () => {
        //Auth middleware
        this.setupAuth();

        this.websocket.on('connection', socket => {
            SSManager.logger.verbose("[Server " + this.server.id + " ] Got socket connection.");
            this.websocket.emit('initialStatus', {
                status: this.server.status,
                installed: this.server.isInstalled,
                blocked: this.server.isBlocked
            });

            this.server.on('statusChange', this.onStatusChange);
            this.server.on('announcement', this.onAnnouncement);
            this.server.on('block', this.onBlock);
            this.server.on('installed', this.onInstalled);
            this.server.on('console', this.onConsole);

            socket.on('getStatus', () => {
                socket.emit('statusUpdate', this.server.status);
            });

            socket.on('disconnect', () => {
                //Remove listeners when we're all done
                socket.removeListener('statusChange', this.onStatusChange);
                socket.removeListener('announcement', this.onAnnouncement);
                socket.removeListener('block', this.onBlock);
                socket.removeListener('installed', this.onInstalled);
                socket.removeListener('console', this.onConsole);
                SSManager.logger.verbose("[Server " + this.server.id + " ] Socket disconnect");
            });

        });
    };

    private setupAuth = () => {
        this.websocket.use((params, next) => {
            //Check for valid token and auth
            if (!params.handshake.query.authentication) { //Check for auth
                return next(new Error('No token.'));
            }
            if (params.handshake.query.authentication !== SSManager.config.api.secret) {
                return next(new Error('Bad token.'));
            }
            return next(); //Everything is good, continue.
        });
    }


}

export {SocketHelper}