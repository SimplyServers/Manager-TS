import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

import * as path from 'path';
import * as querystring from "querystring";
import * as fs from "fs-extra";
import * as userid from "userid";
import {FileError} from "../../../../util/errors/fileError";
import {ServerActionError} from "../../../../util/errors/serverActionError";

class FilesystemHelper extends Helper {
    constructor(server: Gameserver) {
        super(server);
    }

    /*
    File functions
     */
    public getDir = async (partialPath: string) => {
        if(this.server.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        const filePath = this.extendPath(partialPath);
        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        const fileList = await fs.readdir(filePath);

        let fileData = [];
        await Promise.all(fileList.map(async (indFile) => {
            const indFilePath = path.join(filePath, indFile);
            if(this.checkIfIdentity(indFilePath))
                return;

            const ext = path.extname(indFile);

            const stat = await fs.stat(indFilePath);
            fileData.push({
                name: indFile,
                created: new Date(stat.ctime).toLocaleString(),
                modified: new Date(stat.mtime).toLocaleString(),
                size: stat.size,
                symlink: stat.isSymbolicLink(),
                isDir: stat.isDirectory(),
                isFile: stat.isFile(),
                edible: stat.isFile() && !(stat.size > 1000000) && !(ext !== ".txt" && ext !== ".properties" && ext !== ".nbt" && ext !== ".yaml" && ext !== ".json" && ext !== ".yml"  && ext !== ".log")
            })
        }));

        return fileData;
    };

    public getFileContents = async (partialPath: string) => {
        if(this.server.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        const filePath = this.extendPath(partialPath);
        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        const ext = path.extname(filePath);
        if (ext !== ".txt" && ext !== ".properties" && ext !== ".nbt" && ext !== ".yaml" && ext !== ".json" && ext !== ".yml" && ext !== ".log")
            throw new FileError(partialPath);

        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > 1000000)
            throw new FileError(partialPath);

        return await fs.readFile(filePath, "utf8");
    };

    public ensureFile = async (partialPath: string) => {
        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.ensureFile(filePath);
        await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
    };

    public truncateFile = async (partialPath: string) => {
        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.truncate(filePath, 0);
        await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
    };

    public writeFile = async (partialPath: string, contents: string) => {
        if(this.server.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.outputFile(filePath, contents);
        await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
    };

    public removeFile = async (partialPath: string) => {
        if(this.server.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.unlink(filePath);
    };

    public removeFolder = async (partialPath: string) => {
        if(this.server.isBlocked)
            throw new ServerActionError("Server is locked. It may be installing or updating.");

        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.rmdir(filePath);
    };

    /*
    Util
     */
    public checkIfIdentity = (fullPath): boolean => {
        return fullPath === path.join("/home", this.server.id, "/public/identity.json")
    };

    public getRoot = (): string => {
        return path.join("/home/", this.server.id, "/public/");
    };

    public extendPath = (partialPath: string): string => {
        const fullPath = path.join(this.getRoot(), path.normalize(querystring.unescape(partialPath)));
        if (fullPath.indexOf(path.join("/home/", this.server.id, '/public')) !== 0) {
            return this.getRoot();
        }
        return fullPath;
    };
}

export {FilesystemHelper}