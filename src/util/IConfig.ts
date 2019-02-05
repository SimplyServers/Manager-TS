export interface IConfig {
    "servers": {
        "pingTime": number,
        "maxPort": number,
        "minPort": number
    },
    "api": {
        "addr": string,
        "port": number,
        "secret": string
    },
    "socket": {
        "maxFileSize": number
    }
}