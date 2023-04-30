import { CliArgs } from "../args";
import { Logger } from "../common/Logger";
import { TransactionBuilder } from "../common/TransactionBuilder";
import { Web3Manager } from "../common/Web3Manager";
import { ProjectLoader } from "../project/ProjectLoader";

export async function runDeployCommand(options: CliArgs) {

  let privkey: Buffer;
  if(options.privkey === "env" && (process.env.DEPLOYER_PRIVKEY || "").match(/^[0-9a-f]{64}$/i)) {
    privkey = Buffer.from(process.env.DEPLOYER_PRIVKEY, "hex");
  }
  if(options.privkey && options.privkey.match(/^[0-9a-f]{64}$/i)) {
    privkey = Buffer.from(options.privkey, "hex");
  }
  if(!privkey) {
    Logger.error("runDeployCommand", "no wallet privkey for deployment.")
    return;
  }

  ProjectLoader.setProjectsPath(options.projects);
  let web3Manager = new Web3Manager(options.rpchost);
  let txBuilder = new TransactionBuilder({
    web3Manager: web3Manager,
    privkey: privkey,
    maxfeepergas: options.maxfeepergas,
    maxpriofee: options.maxpriofee,
    maxgaslimit: options.maxgaslimit,
  });

  let project = ProjectLoader.loadProject(options.commandArgs.project);
  if(await project.checkDeploymentStatus()) {
    Logger.info("runDeployCommand", "project `" + options.commandArgs.project + "` is already deployed.");
  }
  else {
    // check dependencies
    let depStatus = await project.checkDependencies();
    if(!depStatus.result) {
      Logger.info("runDeployCommand", "missing dependencies for `" + options.commandArgs.project + "`: " + depStatus.missing.join(", "));
      return;
    }

    // deploy project
    Logger.info("runDeployCommand", "deploying project `" + options.commandArgs.project + "`...");
    await project.deployProject(txBuilder);

  }

}
