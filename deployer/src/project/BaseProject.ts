import { ExplorerCodeVerifier, IExplorerYaml, TCodeInputYaml } from "../common/ExplorerCodeVerifier";
import { TransactionBuilder } from "../common/TransactionBuilder";
import { ProjectLoader } from "./ProjectLoader";

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
  "code-verify"?: {[ref: string]: TCodeInputYaml};
}

export interface IProjectStepYaml {
  action: string;
  await?: boolean;
  exit?: boolean;
}

export type TResolvedProjectExports = {[key: string]: string};

export abstract class BaseProject<TProjectYaml extends IProjectYaml = IProjectYaml> {
  protected projectName: string;
  protected projectPath: string;
  protected projectYaml: TProjectYaml;

  public constructor(projectName: string, projectPath: string, projectYaml: TProjectYaml) {
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
  public abstract deployProject(txbuilder: TransactionBuilder): Promise<void>;

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
      let manager = ProjectLoader.loadProject(MANAGER_PROJECT);
      checkPromises.push(manager.checkDeploymentStatus());
      checkProjects.push(manager.getName());
    }

    for(let i = 0; i < this.projectYaml.dependencies.length; i++) {
      let importRef = this.projectYaml.dependencies[i];
      if(!importRef.required)
        continue;
      let project = ProjectLoader.loadProject(importRef.project);
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
    let refSplit = ref.split(":", 2);
    let refValue = ref;
    switch(refSplit[0]) {
      case "contract":
        refValue = refSplit[1];
        break;
      case "ref":
        refValue = this.resolveProjectRef(refSplit[1]);
        break;
      case "ether":
        let etherVal = parseFloat(refSplit[1]);
        refValue = "0x" + (BigInt(etherVal * 1000000000) * 1000000000n).toString(16);
        break;
    }
    return refValue;
  }

  public resolvePlaceholders(data: string): string {
    if(!data)
      return data;
    return data.replace(/\{([^}]+)\}/g, (match) => {
      let placeholder = match.substring(1, match.length-1);
      let refValue = this.resolveReference(placeholder);
      return refValue.replace(/^0x/, "");
    });
  }

  private resolveProjectRef(ref: string): string {
    let refPath = ref.split(".");
    if(refPath.length === 1) {
      // local reference
      let exports = this.resolveExports();
      return exports[refPath[0]];
    }
    else {
      let project = ProjectLoader.loadProject(refPath[0]);
      let exports = project.resolveExports();
      return exports[refPath[1]];
    }
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

  public async verifyCodes(explorer: IExplorerYaml): Promise<{[addr: string]: string}> {
    if(!this.projectYaml['code-verify'])
      return {};
    
    let codeRefs = Object.keys(this.projectYaml['code-verify']);
    let verifyResults: {[addr: string]: string} = {};
    for(let idx = 0; idx < codeRefs.length; idx++) {
      let contractAddr = this.resolveReference(codeRefs[idx]);
      let codeInput = this.projectYaml['code-verify'][codeRefs[idx]];
      verifyResults[contractAddr] = await ExplorerCodeVerifier.verifyProjectSource(contractAddr, codeInput, explorer, this.projectPath);
    }
    return verifyResults;
  }

}
