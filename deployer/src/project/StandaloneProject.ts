import { Logger } from "../common/Logger";
import { TTransactionPromise, Web3Manager } from "../common/Web3Manager";
import { deployStandaloneCallStep, IStandaloneCallStepYaml } from "./actions/StandaloneCallStep";
import { deployStandalonePublishStep, IStandalonePublishStepYaml } from "./actions/StandalonePublishStep";
import { BaseProject, IProjectStepYaml, IProjectYaml, ProjectMode } from "./BaseProject";
import { TransactionReceipt } from "web3-core"
import { TransactionBuilder } from "../common/TransactionBuilder";

export interface IStandaloneProjectYaml extends IProjectYaml {
  account: {
    address: string;
    salt: number;
  }
  steps?: IStandaloneProjectStepYaml[];
}

type TStandaloneProjectStepConditions = [string, string, string][];

export interface IStandaloneProjectStepYaml extends IProjectStepYaml {
  if?: TStandaloneProjectStepConditions;
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

  public async deployProject(txbuilder: TransactionBuilder): Promise<void> {
    if(!this.projectYaml.steps)
      return;
    
    let stepPromises: Promise<TransactionReceipt>[] = [];
    let stepTxHashes: string[] = [];
    steps: for(let stepIdx = 0; stepIdx < this.projectYaml.steps.length; stepIdx++) {
      let stepYaml = this.projectYaml.steps[stepIdx] as IStandaloneProjectStepYaml;
      if(stepYaml.if) {
        if(!await this.checkProjectStepConditions(stepYaml.if)) {
          Logger.error("StandaloneProject.deployProject", "skipping step " + (stepIdx + 1) + ": conditions not met");
          continue;
        }
      }

      let stepRes: TTransactionPromise = null;
      switch(stepYaml.action) {
        case "publish":
          stepRes = await deployStandalonePublishStep({
            project: this,
            txbuilder: txbuilder,
            index: stepIdx,
            nonce: stepIdx,
            stepYaml: stepYaml as IStandalonePublishStepYaml,
          });
          break;
        case "call":
          stepRes = await deployStandaloneCallStep({
            project: this,
            txbuilder: txbuilder,
            index: stepIdx,
            nonce: stepIdx,
            stepYaml: stepYaml as IStandaloneCallStepYaml,
          });
          break;
        default:
          Logger.error("StandaloneProject.deployProject", "unknown deployment action `" + stepYaml.action + "` in step " + (stepIdx + 1));
          continue steps;
      }

      if(stepRes) {
        Logger.info("StandaloneProject.deployProject", "deploying step " + (stepIdx + 1) + ": " + stepYaml.action + " [tx " + stepRes[0] + "]");
        stepTxHashes.push(stepRes[0]);
        stepPromises.push(stepRes[1]);
      }
      else {
        Logger.info("StandaloneProject.deployProject", "deployment step " + (stepIdx + 1) + " returned no deployment result - unknown status");
      }

      if(stepYaml.await) {
        await Promise.all(stepPromises);
      }
    }

    await Promise.all(stepPromises);
  }

  private async checkProjectStepConditions(conditions: TStandaloneProjectStepConditions): Promise<boolean> {
    if(!conditions)
      return true;
  
    for(let i = 0; i < conditions.length; i++) {
      let condition = conditions[i];
      let [leftSide, rightSide] = await Promise.all([
        this.resolveStepConditionTerm(condition[0]),
        this.resolveStepConditionTerm(condition[2]),
      ]);
      switch(condition[1]) {
        case ">": if(!(leftSide > rightSide)) return false; break;
        case ">=": if(!(leftSide >= rightSide)) return false; break;
        case "<": if(!(leftSide < rightSide)) return false; break;
        case "<=": if(!(leftSide <= rightSide)) return false; break;
        case "==": if(!(leftSide == rightSide)) return false; break;
        default:
          Logger.error("StandaloneProject.checkProjectStepConditions", "invalid condition operator: " + condition[1]);
          return false;
      }
    }
  
    return true;
  }
  
  private async resolveStepConditionTerm(term: string): Promise<any> {
    let fnmatch;
    if((fnmatch = /^([^()]*)\(([^)]+)\)$/.exec(term))) {
      let fnargs = fnmatch[2].split(",");
      switch(fnmatch[1]) {
        case "balance":
          return await Web3Manager.instance.getBalance.apply(this, fnargs);
        case "iscontract":
          return await Web3Manager.instance.isContract.apply(this, fnargs);
        default:
          Logger.error("StandaloneProject.resolveStepConditionTerm", "invalid condition term fn: " + fnmatch[1]);
          return null;
      }
    }
    
    if(term === "true")
      return true;
    else if(term === "false")
      return false;
    else if(/^[0-9]+$/.exec(term))
      return parseFloat(term);
    else
      return term;
  }

}