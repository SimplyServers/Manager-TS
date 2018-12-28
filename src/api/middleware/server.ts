import {ValidationError} from "../../util/errors/validationError";
import {ServerActionError} from "../../util/errors/serverActionError";

class ServerMiddleware {
    public getServer = async (req, res, next) => {
        if (!req.params.server)
            return next(new ValidationError("server"));

        const server = req.app.locals.serverController.servers.find(server => server.id === req.params.server);

        if (server === undefined)
            return next(new ServerActionError("Server not found"));

        req.server = server;
        return next();
    };
}

export {ServerMiddleware}