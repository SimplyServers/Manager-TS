import {Helper} from "./helper";
import {Gameserver} from "../gameserver";

import * as path from 'path';
import * as querystring from "querystring";
import * as fs from "fs-extra";
import * as userid from "userid";
import {FileError} from "../../../../util/errors/fileError";

class FilesystemHelper extends Helper {
    constructor(server: Gameserver) {
        super(server);
    }

    /*
    File functions
     */
    public getDir = async (partialPath: string) => {
        const filePath = this.extendPath(partialPath);
        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        const fileList = await fs.readdir(filePath);

        let fileData = [];
        await Promise.all(fileList.map(async (indFile) => {
            const stat = await fs.stat(indFile);
            fileData.push({
                name: indFile,
                created: stat.ctime,
                modified: stat.mtime,
                size: stat.size,
                symlink: stat.isSymbolicLink(),
            })
        }));

        return fileData;
    };

    public getFileContents = async (partialPath: string) => {
        const filePath = this.extendPath(partialPath);
        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        const ext = path.extname(filePath);
        if (ext !== ".txt" && ext !== ".properties" && ext !== ".nbt" && ext !== ".yaml" && ext !== ".json")
            throw new FileError(partialPath);

        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > 40000)
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
        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.outputFile(filePath, contents);
        await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
    };

    public removeFile = async (partialPath: string) => {
        const filePath = this.extendPath(partialPath);

        if (this.checkIfIdentity(filePath))
            throw new FileError(partialPath);

        await fs.unlink(filePath);
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