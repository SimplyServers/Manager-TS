import {SSManager} from "../ssmanager";
import * as path from 'path';
import * as winston from 'winston';

class Logger {

    //TODO: implement fs logging
    private readonly logToFile;
    private logger;

    constructor(logToFile: boolean) {
        this.logToFile = logToFile;

        const options = {
            file: {
                level: 'info',
                filename: path.join(SSManager.getRoot(), "../app.log"),
                handleExceptions: true,
                json: true,
                maxsize: 5242880, // 5MB
                maxFiles: 5,
                colorize: false,
            },
            console: {
                level: 'debug',
                handleExceptions: true,
                json: false,
                colorize: true,
            },
        };

        this.logger = winston.createLogger({
            transports: [
                new winston.transports.File(options.file),
                new winston.transports.Console(options.console)
            ],
            exitOnError: false
        })
    }

    public info = (message: string) => {
        this.logger.info("[Info] " + message)
    };

    public verbose = (message: string) => {
        this.logger.debug("[Verbose] " + message)
    };

    public error = (message: string) => {
        this.logger.error("[Verbose] " + message)
    };

}

export {Logger}