import { SSManager } from "../../SSManager";
import { ServerActionError } from "../../util/errors/ServerActionError";
import { ValidationError } from "../../util/errors/ValidationError";

class ServerMiddleware {
  public getServer = async (req, res, next) => {
    if (!req.params.server) {
      return next(new ValidationError("server"));
    }

    const server = SSManager.serverController.servers.find(server => server.id === req.params.server);

    if (server === undefined) {
      return next(new ServerActionError("Server not found"));
    }

    req.server = server;
    return next();
  };
}

export { ServerMiddleware };