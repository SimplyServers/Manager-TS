import * as diskspace from "diskspace";
import * as osUtils from "os-utils";

export class NodeController {
  public getStatus = async (req, res, next) => {
    osUtils.cpuUsage(function(cpu) {
      diskspace.check("/", function(err, disk) {
        let status = {};
        if (err) {
          status = {
            cpu,
            totalmem: osUtils.totalmem(),
            freemem: osUtils.freemem(),
            totaldisk: 1,
            freedisk: 1
          };
        } else {
          status = {
            cpu,
            totalmem: osUtils.totalmem(),
            freemem: osUtils.freemem(),
            totaldisk: disk.total,
            freedisk: disk.free
          };
        }
        res.json(status);
      });
    });
  };
}