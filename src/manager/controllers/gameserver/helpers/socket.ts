import {Helper} from "./helper";
import {Gameserver} from "../gameserver";
import {SSManager} from "../../../../ssmanager";

import * as SocketIOStream from "socket.io-stream";
import * as fs from "fs-extra";
import * as path from "path";
import * as userid from "userid";

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
                this.server.removeListener('statusChange', this.onStatusChange);
                this.server.removeListener('announcement', this.onAnnouncement);
                this.server.removeListener('block', this.onBlock);
                this.server.removeListener('installed', this.onInstalled);
                this.server.removeListener('console', this.onConsole);
                SSManager.logger.verbose("[Server " + this.server.id + " ] Socket disconnect");
            });

            //Download file event
            SocketIOStream(socket).on('download', (stream, data) => {
                if (!data.path) {
                    return;
                }
                let filePath = this.server.fsHelper.extendPath(data.path);

                if (filePath === "/home/" + this.server.id + "/public/identity.json") {
                    return;
                }

                fs.stat(filePath, (err, stat) => {
                    if (err) {
                        socket.emit('fail', 'File does not exist.');
                        socket.disconnect();
                    }
                    if (stat.isDirectory()) { //This is a dir ;/
                        socket.emit('fail', 'Must be a file');
                        socket.disconnect();
                    } else if (!stat.isFile()) { //Lol wtf would this be?
                        socket.emit('fail', 'Must be a file');
                        socket.disconnect();
                    }

                    console.log("piping...");
                    fs.createReadStream(filePath).pipe(stream);

                    stream.on('close', () => {
                        console.log("done!");
                        socket.emit('status', 'done');
                        socket.disconnect();
                    });
                });
            });
            //Upload file event
            SocketIOStream(socket).on('upload', (stream, data) => { //TODO: check for possible file size limit bypass? I'm pretty sure the stream is generated server side.
                if (!stream._readableState) { //Make sure we include the options
                    socket.emit('fail', 'An error occurred.');
                    socket.disconnect();
                } else if (stream._readableState.highWaterMark > (SSManager.config.socket.maxFileSize * 1000000)) { //Make sure file size is under the config. 1000000b = 1mb
                    socket.emit('fail', 'File too big');
                    socket.disconnect();
                }
                if (!data.path || !data.name) {
                    socket.emit('fail', 'Must specify path and name');
                    socket.disconnect();
                }
                //Check to make sure the target isn't an existing folder
                let filePath = this.server.fsHelper.extendPath(path.join(data.path, data.name)); //Almost forgot to extend the path after we joined hehe.
                fs.stat(filePath).then(() => {

                    if (filePath === "/home/" + this.server.id + "/public/identity.json") {
                        socket.emit('fail', 'Restricted file target');
                        socket.disconnect();
                    }

                    stream.pipe(fs.createWriteStream(filePath));
                    fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id), () => {
                        //Tell the manager we're done and disconnect
                        socket.emit('status', 'done');
                        socket.disconnect();
                    });
                }).catch(() => {
                    stream.pipe(fs.createWriteStream(filePath));
                    fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id), () => {
                        //Tell the manager we're done and disconnect
                        socket.emit('status', 'done');
                        socket.disconnect();
                    });
                });
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