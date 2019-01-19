import {SSManager} from "../../ssmanager";

class AuthMiddleware {
    public authRequired = async (req, res, next) => {
        if (!req.headers.authorization) {
            return res.status(403).json({error: true, msg: "no_token"});
        }

        if (this.getTokenFromHeaders(req) !== SSManager.config.api.secret) {
            return res.status(403).json({error: true, msg: "bad_token"});
        }

        next();
    };

    private getTokenFromHeaders = (req) => {
        const {headers: {authorization}} = req;
        if (authorization && authorization.split(' ')[0] === 'Token') {
            return authorization.split(' ')[1];
        }
        return null;
    };
}

export {AuthMiddleware}