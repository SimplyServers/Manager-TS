import * as diskspace from "diskspace";
import * as osUtils from "os-utils";

class NodeController{
    public getStatus = async (req, res, next) => {
        osUtils.cpuUsage(function (cpu) {
            diskspace.check('/', function (err, disk) {
                let status = {};
                if (err) {
                    status = {
                        cpu: cpu,
                        totalmem: osUtils.totalmem(),
                        freemem: osUtils.freemem(),
                        totaldisk: "unknown",
                        freedisk: "unknown"
                    };
                } else {
                    status = {
                        cpu: cpu,
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

export { NodeController }