import { GameServer } from "../GameServer";

class Helper {
  protected readonly server: GameServer;

  constructor(server: GameServer) {
    this.server = server;
  }
}

export { Helper };