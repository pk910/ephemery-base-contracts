import { CliArgs } from "../args";
import { Logger } from "../common/Logger";
import { MessageSigner } from "../common/MessageSigner";
import { ProjectMode } from "../project/BaseProject";
import { ManagedProject } from "../project/ManagedProject";
import { ProjectLoader } from "../project/ProjectLoader";

export async function runSignCommand(options: CliArgs) {

  let privkey: Buffer;
  if(options.privkey === "env" && (process.env.DEPLOYER_PRIVKEY || "").match(/^[0-9a-f]{64}$/i)) {
    privkey = Buffer.from(process.env.DEPLOYER_PRIVKEY, "hex");
  }
  if(options.privkey && options.privkey.match(/^[0-9a-f]{64}$/i)) {
    privkey = Buffer.from(options.privkey, "hex");
  }
  if(!privkey) {
    Logger.error("runSignCommand", "no wallet privkey for deployment.")
    return;
  }

  let msgSigner = new MessageSigner(privkey);

  let project: ManagedProject = ProjectLoader.loadProject(options.commandArgs.project) as ManagedProject;
  if(project.getMode() !== ProjectMode.MANAGED) {
    Logger.error("runSignCommand", "not a managed project, no signatures required.")
    return;
  }

  let signatures = await project.generateSignatures(msgSigner);

  console.log("signatures: ");
  signatures.forEach((sig) => console.log(sig));

}
