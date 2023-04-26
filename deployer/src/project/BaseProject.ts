
import path from "path";
import fs from "fs";
import yaml from "yaml";
import { ManagedProject } from "./ManagedProject";
import { StandaloneProject } from "./StandaloneProject";

export enum ProjectMode {
  STANDALONE = "standalone",
  MANAGED = "managed",
}

export const MANAGER_PROJECT = "_manager";

export interface IProjectYaml {
  mode: string;
  dependencies?: {
    project: string;
    required?: boolean;
  }[];
  exports?: {
    [key: string]: string;
  };
  steps?: IProjectStepYaml[];
}

export interface IProjectStepYaml {
  action: string;
}

export type TResolvedProjectExports = {[key: string]: string};

export abstract class BaseProject<TProjectYaml extends IProjectYaml = IProjectYaml> {
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

  protected projectName: string;
  protected projectPath: string;
  protected projectYaml: TProjectYaml;

  protected constructor(projectName: string, projectPath: string, projectYaml: TProjectYaml) {
    this.projectName = projectName;
    this.projectPath = projectPath;
    this.projectYaml = projectYaml;
    this.init();
  }

  public getName(): string {
    return this.projectName;
  }

  public getPath(): string {
    return this.projectPath;
  }

  protected init() {}

  public abstract getMode(): ProjectMode;
  public abstract checkDeploymentStatus(): Promise<boolean>;

  public getDependencies(): string[] {
    if(!this.projectYaml.dependencies || !Array.isArray(this.projectYaml.dependencies) || this.projectYaml.dependencies.length == 0)
      return [];
    return this.projectYaml.dependencies.filter((dep) => dep.required).map((dep) => dep.project);
  }

  public async checkDependencies(): Promise<{
    result: boolean;
    missing?: string[];
  }> {
    if(!this.projectYaml.dependencies || !Array.isArray(this.projectYaml.dependencies) || this.projectYaml.dependencies.length == 0)
      return {result: true};

    let checkPromises: Promise<boolean>[] = [];
    let checkProjects: string[] = [];

    if(this.getMode() == ProjectMode.MANAGED) {
      let manager = BaseProject.loadProject(MANAGER_PROJECT);
      checkPromises.push(manager.checkDeploymentStatus());
      checkProjects.push(manager.getName());
    }

    for(let i = 0; i < this.projectYaml.dependencies.length; i++) {
      let importRef = this.projectYaml.dependencies[i];
      if(!importRef.required)
        continue;
      let project = BaseProject.loadProject(importRef.project);
      checkPromises.push(project.checkDeploymentStatus());
      checkProjects.push(project.getName());
    }
    if(checkPromises.length == 0)
      return {result: true};

    let checkResults = await Promise.all(checkPromises);
    let missing: string[] = [];
    for(let i = 0; i < checkResults.length; i++) {
      if(!checkResults[i]) {
        missing.push(checkProjects[i]);
      }
    }

    if(missing.length == 0)
      return {result: true};
    else
      return {result: false, missing: missing};
  }

  public resolveReference(ref: string): string {
    let refSplit = ref.split(":");
    let refValue = ref;
    switch(refSplit[0]) {
      case "contract":
        refValue = refSplit[1];
        break;
    }
    return refValue;
  }

  public resolveExports(): TResolvedProjectExports {
    if(!this.projectYaml.exports)
      return {};

    let exports: TResolvedProjectExports = {};
    Object.keys(this.projectYaml.exports).forEach((key) => {
      exports[key] = this.resolveReference(this.projectYaml.exports[key]);
    });
    return exports;
  }

}
