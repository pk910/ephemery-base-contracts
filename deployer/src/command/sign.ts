import path from "path";
import fs from "fs";
import yaml from "yaml";
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

  ProjectLoader.setProjectsPath(options.projects);
  let msgSigner = new MessageSigner(privkey);

  let project: ManagedProject = ProjectLoader.loadProject(options.commandArgs.project) as ManagedProject;
  if(project.getMode() !== ProjectMode.MANAGED) {
    Logger.error("runSignCommand", "not a managed project, no signatures required.");
    return;
  }

  let signatures = await project.generateSignatures(msgSigner);
  Logger.info("runSignCommand", "generated " + signatures.length + " deployment signatures for `" + project.getName() + "`.");

  let sigFile = path.join(project.getPath(), "signatures.yaml");
  let sigYaml;
  if(fs.existsSync(sigFile)) {
    sigYaml = yaml.parse(fs.readFileSync(sigFile, "utf-8"))
  }
  else {
    sigYaml = {};
  }

  let managerAddr = project.getDeploymentManagerAddress();
  let oldSignatures = sigYaml[managerAddr.toLowerCase()];
  let updateSignatures: boolean;
  if(!oldSignatures) 
    updateSignatures = true;
  else {
    if(oldSignatures.signatures.length !== signatures.length)
      updateSignatures = true;
    else {
      updateSignatures = false;
      for(let sigIdx = 0; sigIdx < signatures.length; sigIdx++) {
        if(oldSignatures.signatures[sigIdx] !== signatures[sigIdx]) {
          updateSignatures = true;
          break;
        }
      }
    }
  }

  if(updateSignatures) {
    sigYaml[managerAddr.toLowerCase()] = {
      signtime: Math.floor((new Date()).getTime() / 1000),
      signatures: signatures,
    };
    
    fs.writeFileSync(sigFile, yaml.stringify(sigYaml, {
      lineWidth: 0
    }));
    Logger.info("runSignCommand", "updated signatures.yaml: " + sigFile);
  }
  else {
    Logger.info("runSignCommand", "no need to update signatures.yaml");
  }
}
