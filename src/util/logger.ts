class Logger {

    //TODO: implement fs logging
    private readonly logToFile;

    constructor(logToFile: boolean) {
        this.logToFile = logToFile;
    }

    public info = (message: string) => {
        console.log("[Info] " + message)
    };

    public verbose = (message: string) => {
        if (process.env.NODE_ENV === 'dev')
            console.debug("[Verbose] " + message)
    };

    public error = (message: string) => {
        console.error("[Error] " + message)
    };

}

export {Logger}