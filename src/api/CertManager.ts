import * as proc from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as util from "util";
import { SSManager } from "../SSManager";

export class CertManager {
  public ensureCerts = async (): Promise<void> => {
    try {
      await fs.stat(path.join(SSManager.getRoot(), "../certs/server.cert"));
      await fs.stat(path.join(SSManager.getRoot(), "../certs/server.key"));
    } catch (e) {
      SSManager.logger.info("Generating SSL certificate...");
      await this.generateCerts();
      SSManager.logger.info("SSL certificate generated");
    }
  };

  public getOptions = async (): Promise<object> => {
    return {
      key: await fs.readFile(path.join(SSManager.getRoot(), "../certs/server.key")),
      cert: await fs.readFile(path.join(SSManager.getRoot(), "../certs/server.cert"))
    };
  };

  private generateCerts = async (): Promise<void> => {
    await new Promise((resolve, reject) => {
      proc.exec(util.format(path.join(SSManager.getRoot(), "/bashScripts/generateSsl.sh") + " %s", SSManager.config.api.addr), { cwd: path.join(SSManager.getRoot(), "../certs/") }, (err) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve();
        }
      });
    });
  };
}

