export interface IGame {
  name: string,
  gamedig: {
    active: boolean,
    id: string
  }
  install: any,
  update: any,
  startCommand: string,
  stopConsoleCommand: string,
  dockerType: string, // This should be an enum but I don't want to break stuff when it comes to backwards compatibility.
  logging: {
    logFile: {
      useLogFile: boolean,
      path: string
    }
    useStdout: boolean,
  },
  verify: any
}