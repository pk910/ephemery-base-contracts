import path from "path";
import fs from "fs";
import yaml from "yaml";
import { CliArgs } from "../args";
import { Logger } from "../common/Logger";
import { ProjectLoader } from "../project/ProjectLoader";

export async function runVerifyCodesCommand(options: CliArgs) {
  ProjectLoader.setProjectsPath(options.projects);

  let project = ProjectLoader.loadProject(options.commandArgs.project);

  // load explorers.yaml
  if(!fs.existsSync(options.commandArgs.explorers)) {
    console.log("could not find " + options.commandArgs.explorers);
    return;
  }
  var explorersYaml = yaml.parse(fs.readFileSync(options.commandArgs.explorers, "utf-8"));
  var explorers = explorersYaml.explorers || [];
  if(explorers.length == 0)
    return;

  for(let i = 0; i < explorers.length; i++) {
    await project.verifyCodes(explorers[i]);
  }
  
  Logger.info("runVerifyCodesCommand", "code verification completed.");
}
