import {DockerTypes} from "../../../util/dockerTypes";

interface IGame {
    name: string,
    gamedig: {
        active: boolean,
        id: string
    }
    install: any,
    update: any,
    startCommand: string,
    stopConsoleCommand: string,
    dockerType: DockerTypes,
    logging: {
        logFile: {
            useLogFile: boolean,
            path: string
        }
        useStdout: boolean,
    },
    verify: any
}

export {IGame}