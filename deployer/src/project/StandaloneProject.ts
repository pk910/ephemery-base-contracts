import { Web3Manager } from "../common/Web3Manager";
import { IStandaloneCallStepYaml } from "./actions/StandaloneCallStep";
import { IStandalonePublishStepYaml } from "./actions/StandalonePublishStep";
import { BaseProject, IProjectStepYaml, IProjectYaml, ProjectMode } from "./BaseProject";

export interface IStandaloneProjectYaml extends IProjectYaml {
  account: {
    address: string;
    salt: number;
  }
  steps?: (IStandaloneCallStepYaml | IStandalonePublishStepYaml)[];
}

export interface IStandaloneProjectStepYaml extends IProjectStepYaml {
  if?: [string, string, string][];
}

export class StandaloneProject extends BaseProject {

  public getMode(): ProjectMode {
    return ProjectMode.STANDALONE;
  }

  public async checkDeploymentStatus(): Promise<boolean> {
    if(!this.projectYaml.exports)
      return true;

    let exportKeys = Object.keys(this.projectYaml.exports);
    let checkPromises: Promise<boolean>[] = [];
    for(let i = 0; i < exportKeys.length; i++) {
      let exportKey = exportKeys[i];
      let exportRef = this.projectYaml.exports[exportKey];
      let exportRefSplit = exportRef?.split(":");
      if(exportRefSplit.length >= 2) {
        switch(exportRefSplit[0]) {
          case "contract":
            checkPromises.push(Web3Manager.instance.isContract(exportRefSplit[1]));
            break;
        }
      }
    }

    let checkResults = await Promise.all(checkPromises);
    for(let i = 0; i < checkResults.length; i++) {
      if(!checkResults[i])
        return false;
    }
    return true;
  }

}