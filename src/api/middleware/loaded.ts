import {SSManager} from "../../ssmanager";

class LoadedMiddleware{
    public mustBeLoaded = async (req, res, next) => {
        if(!SSManager.loaded) {
            res.json({error: true, msg: "SSManager is still loading. Please wait."});
            return;
        }
        next();
    };
}

export {LoadedMiddleware}