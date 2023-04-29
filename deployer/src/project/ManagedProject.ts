import { ContractInterface } from "../common/ContractInterface";
import { deployManagedCallStep, IManagedCallStepYaml } from "./actions/ManagedCallStep";
import { IManagedCreateStepYaml } from "./actions/ManagedCreateStep";
import { IManagedCreate2StepYaml } from "./actions/ManagedCreate2Step";
import { BaseProject, IProjectStepYaml, IProjectYaml, MANAGER_PROJECT, ProjectMode } from "./BaseProject";
import { calculateCreateAddr } from "../utils/CreateAddr";
import { ProjectLoader } from "./ProjectLoader";
import { TTransactionPromise } from "../common/Web3Manager";
import { TransactionReceipt } from "web3-core"
import { TransactionBuilder } from "../common/TransactionBuilder";
import { Logger } from "../common/Logger";

export interface IDeploymentAccount {
  address: string;
  salt: number;
}

export interface IManagedProjectYaml extends IProjectYaml {
  account: {
    address: string;
    salt: number;
  }
  steps?: (IManagedCallStepYaml | IManagedCreateStepYaml | IManagedCreate2StepYaml)[];
}

export interface IManagedProjectStepYaml extends IProjectStepYaml {
}

export class ManagedProject extends BaseProject<IManagedProjectYaml> {
  
  public getMode(): ProjectMode {
    return ProjectMode.MANAGED;
  }

  public getProjectAccount(): [string, number] {
    return [this.projectYaml.account.address, this.projectYaml.account.salt];
  }

  public getDeployerAddress(): string {
    let manager = ProjectLoader.loadProject(MANAGER_PROJECT);
    let managerAddr = manager.resolveExports()["DeploymentManager"];
    return ContractInterface.getDeploymentAccountAddress(managerAddr, this.projectYaml.account.address, this.projectYaml.account.salt);
  }

  public async checkDeploymentStatus(): Promise<boolean> {
    let deployerNonce = await this.getDeploymentNonce();
    let finalNonce = this.projectYaml.steps ? this.projectYaml.steps.length : 0;
    return (deployerNonce >= finalNonce);
  }

  public async getDeploymentNonce(): Promise<number> {
    let deployerAddr = this.getDeployerAddress();
    let deployerContract = ContractInterface.getDeploymentAccount(deployerAddr);
    return parseInt(await deployerContract.methods["callNonce"]().call());
  }

  public override resolveReference(ref: string): string {
    let refSplit = ref.split(":");
    let refValue = ref;
    switch(refSplit[0]) {
      case "create":
        refValue = this.getDeployerAddress();
        for(let ridx = 1; ridx < refSplit.length; ridx++) {
          refValue = calculateCreateAddr(refValue, parseInt(refSplit[ridx]));
        }
        break;
      default:
        refValue = super.resolveReference(ref);
        break;
    }
    return refValue;
  }
  
  public async deployProject(txbuilder: TransactionBuilder): Promise<void> {
    let manager = ProjectLoader.loadProject(MANAGER_PROJECT);
    let managerAddr = manager.resolveExports()["DeploymentManager"];
    let managerContract = ContractInterface.getDeploymentAccount(managerAddr);
    let deployerNonce = await this.getDeploymentNonce();
    if(!this.projectYaml.steps)
      return;
    
    let stepPromises: Promise<TransactionReceipt>[] = [];
    let stepTxHashes: string[] = [];
    steps: for(let stepIdx = deployerNonce; stepIdx < this.projectYaml.steps.length; stepIdx++) {
      let stepYaml = this.projectYaml.steps[stepIdx] as IManagedProjectStepYaml;

      let stepRes: TTransactionPromise = null;
      switch(stepYaml.action) {
        case "call":
          stepRes = await deployManagedCallStep({
            project: this,
            txbuilder: txbuilder,
            index: stepIdx,
            nonce: stepIdx,
            stepYaml: stepYaml as IManagedCallStepYaml,
            managerContract: managerContract,
            signature: null,
          });
          break;
        default:
          Logger.error("ManagedProject.deployProject", "unknown deployment action `" + stepYaml.action + "` in step " + (stepIdx + 1));
          continue steps;
      }

      if(stepRes) {
        Logger.info("ManagedProject.deployProject", "deploying step " + (stepIdx + 1) + ": " + stepYaml.action + " [tx " + stepRes[0] + "]");
        stepTxHashes.push(stepRes[0]);
        stepPromises.push(stepRes[1]);
      }
      else {
        Logger.info("ManagedProject.deployProject", "deployment step " + (stepIdx + 1) + " returned no deployment result - unknown status");
      }

      if(stepYaml.await) {
        await Promise.all(stepPromises);
      }
    }

    await Promise.all(stepPromises);
  }

}

