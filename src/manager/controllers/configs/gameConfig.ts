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
        useLogFile: boolean,
        path: string
    },
    verify: any
}

export {IGame}