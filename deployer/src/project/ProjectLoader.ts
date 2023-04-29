import path from "path";
import fs from "fs";
import yaml from "yaml";
import { BaseProject } from "./BaseProject";
import { ManagedProject } from "./ManagedProject";
import { StandaloneProject } from "./StandaloneProject";

export class ProjectLoader {
  private static projectDefinitions: {[project: string]: BaseProject} = {};

  public static loadProject(projectName: string, projectPath?: string) {
    if(this.projectDefinitions[projectName])
      return this.projectDefinitions[projectName];

    if(!projectPath) {
      projectPath = path.join(".", "projects", projectName);
    }

    let projectYamlFile = path.join(projectPath, "deployment.yaml");
    if(!fs.existsSync(projectYamlFile)) {
      throw "could not load " + projectYamlFile;
    }
    let projectYaml = yaml.parse(fs.readFileSync(projectYamlFile, "utf-8"));

    let projectDefinition: BaseProject;
    switch(projectYaml.mode) {
      case "standalone": 
      case "unmanaged": 
        projectDefinition = new StandaloneProject(projectName, projectPath, projectYaml);
        break;
      case "managed": 
        projectDefinition = new ManagedProject(projectName, projectPath, projectYaml);
        break;
      default:
        throw "unknown deployment mode '" + projectYaml.mode + "' (" + projectName + ")";
    }
    this.projectDefinitions[projectName] = projectDefinition;
    return projectDefinition;
  }
}
