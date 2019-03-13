import * as devNull from "dev-null";
import * as Dockerode from "dockerode";
import * as DockerodeUtils from "dockerode-utils";
import * as path from "path";

import { SSManager } from "../SSManager";

class DockerInstaller {

  public bootstrap = async (): Promise<void> => {
    if (!(await DockerodeUtils.imageExists(this.dockerContoller, "ssjava"))) {
      await this.addImage(path.join(SSManager.getRoot(), "../dockerfiles/java/"), "ssjava");
    }
  };
  private readonly dockerContoller;
  private addImage = async (filePath: string, name: string): Promise<void> => {
    SSManager.logger.verbose("Adding Docker image for " + name);

    await new Promise((resolve, reject) => {
      this.dockerContoller.buildImage({
        context: filePath,
        src: ["Dockerfile"]
      }, { t: name }, (err, stream) => {
        if (err) {
          return reject(err);
        }

        // Pipe the stream to its doom!
        stream.pipe(devNull(), { end: true });

        // Return when its done installing
        stream.on("end", () => {
          return resolve();
        });
      });
    });
  };

  constructor() {
    // TODO: may need to add a config option for specificity this manually
    this.dockerContoller = new Dockerode({
      socketPath: "/var/run/docker.sock"
    });
  }
}

export { DockerInstaller };