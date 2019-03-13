import { IGame } from "./IGame";

export interface IServer {
  game: IGame,
  id: string,
  port: number,
  build: {
    io: number,
    cpu: number,
    mem: number
  },
  plugins: any,
  installed: boolean,
  players: number
}