import { GameServer } from "../GameServer";
import { Helper } from "./Helper";

import * as fs from "fs-extra";
import * as path from "path";
import * as querystring from "querystring";
import * as userid from "userid";
import { FileError } from "../../../../util/errors/FileError";
import { ServerActionError } from "../../../../util/errors/ServerActionError";

class FilesystemHelper extends Helper {

  constructor(server: GameServer) {
    super(server);
  }
  /*
  File functions
   */
  public getDir = async (partialPath: string) => {
    if (this.server.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    const filePath = this.extendPath(partialPath);
    if (this.checkBlocked(filePath)) {
      throw new FileError(partialPath);
    }

    const fileList = await fs.readdir(filePath);

    const fileData = [];
    await Promise.all(fileList.map(async (indFile) => {
      const indFilePath = path.join(filePath, indFile);
      if (this.checkBlocked(indFilePath)) {
        return;
      }

      const stat = await fs.stat(indFilePath);
      fileData.push({
        name: indFile,
        created: new Date(stat.ctime).toLocaleString(),
        modified: new Date(stat.mtime).toLocaleString(),
        size: stat.size,
        symlink: stat.isSymbolicLink(),
        isDir: stat.isDirectory(),
        isFile: stat.isFile(),
        edible: stat.isFile() && !(stat.size > 1000000) && this.checkEdible(indFile)
      });
    }));

    return fileData;
  };
  public getFileContents = async (partialPath: string) => {
    if (this.server.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    const filePath = this.extendPath(partialPath);

    if (this.checkBlocked(filePath)) {
      throw new FileError(partialPath);
    }

    if (!this.checkEdible(filePath)) {
      throw new FileError(partialPath);
    }

    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > 1000000) {
      throw new FileError(partialPath);
    }

    return fs.readFile(filePath, "utf8");
  };
  public writeFile = async (partialPath: string, contents: string) => {
    if (this.server.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    const filePath = this.extendPath(partialPath);

    if (!this.checkEdible(filePath)) {
      throw new FileError(partialPath);
    }

    if (this.checkBlocked(filePath)) {
      throw new FileError(partialPath);
    }

    await fs.outputFile(filePath, contents);
    await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
  };
  public removeFile = async (partialPath: string) => {
    if (this.server.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    const filePath = this.extendPath(partialPath);

    if (this.checkBlocked(filePath)) {
      throw new FileError(partialPath);
    }

    if (!this.checkEdible(filePath)) {
      throw new FileError(partialPath);
    }

    await fs.unlink(filePath);
  };
  public removeFolder = async (partialPath: string) => {
    if (this.server.isBlocked) {
      throw new ServerActionError("SERVER_LOCKED");
    }

    const filePath = this.extendPath(partialPath);

    if (this.checkBlocked(filePath)) {
      throw new FileError(partialPath);
    }

    await fs.rmdir(filePath);
  };
  public checkAllowed = (potentialFile: string): boolean => {
    return this.checkBlocked(potentialFile) && this.checkEdible(potentialFile);
  };
  // This is not effected by checkEdible() or checkBlocked() because its used internally only.
  public ensureFile = async (partialPath: string) => {
    const filePath = this.extendPath(partialPath);

    await fs.ensureFile(filePath);
    await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
  };

  /*
  Util
   */
  // Same with truncate
  public truncateFile = async (partialPath: string) => {
    const filePath = this.extendPath(partialPath);

    await fs.truncate(filePath, 0);
    await fs.chown(filePath, userid.uid(this.server.id), userid.gid(this.server.id));
  };
  // Check if the file follows file extension guidelines
  public checkEdible = (fullPath: string): boolean => {
    const ext = path.extname(fullPath);
    return (ext === ".txt" || ext === ".properties" || ext === ".nbt" || ext === ".yaml" || ext === ".json" || ext === ".yml" || ext === ".log");
  };
  // Check if the file is either the logging file or the identity.json file
  public checkBlocked = (fullPath): boolean => {
    // return fullPath === path.join("/home", this.server.id, "/public/identity.json")
    if (fullPath === path.join("/home", this.server.id, "/public/identity.json")) {
      return true;
    }
    return this.server.currentGame.logging.logFile.useLogFile && fullPath === path.join("/home", this.server.id, "/public", this.server.currentGame.logging.logFile.path);
  };
  public getRoot = (): string => {
    return path.join("/home/", this.server.id, "/public/");
  };
  public extendPath = (partialPath: string): string => {
    const fullPath = path.join(this.getRoot(), path.normalize(querystring.unescape(partialPath)));
    if (fullPath.indexOf(path.join("/home/", this.server.id, "/public")) !== 0) {
      return this.getRoot();
    }
    return fullPath;
  };
}

export { FilesystemHelper };
