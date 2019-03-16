import { GameServer } from "../GameServer";

export class Helper {
  protected readonly server: GameServer;

  constructor(server: GameServer) {
    this.server = server;
  }
}