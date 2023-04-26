import { ContractInterface } from "../common/ContractInterface";
import { IManagedCallStepYaml } from "./actions/ManagedCallStep";
import { IManagedCreateStepYaml } from "./actions/ManagedCreateStep";
import { IManagedCreate2StepYaml } from "./actions/ManagedCreate2Step";
import { BaseProject, IProjectStepYaml, IProjectYaml, MANAGER_PROJECT, ProjectMode, TResolvedProjectExports } from "./BaseProject";
import { calculateCreateAddr } from "../utils/CreateAddr";

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

  public getDeployerAddress(): string {
    let manager = BaseProject.loadProject(MANAGER_PROJECT);
    let managerAddr = manager.resolveExports()["DeploymentManager"];
    return ContractInterface.getDeploymentAccountAddress(managerAddr, this.projectYaml.account.address, this.projectYaml.account.salt);
  }

  public async checkDeploymentStatus(): Promise<boolean> {
    let deployerAddr = this.getDeployerAddress();
    let deployerNonce = await this.getDeploymentNonce(deployerAddr);
    let finalNonce = this.projectYaml.steps ? this.projectYaml.steps.length : 0;
    return (deployerNonce >= finalNonce);
  }

  private async getDeploymentNonce(deployerAddr: string): Promise<number> {
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
  

}
