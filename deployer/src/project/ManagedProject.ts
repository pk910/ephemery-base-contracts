import path from "path";
import fs from "fs";
import yaml from "yaml";
import { ContractInterface } from "../common/ContractInterface";
import { deployManagedCallStep, getManagedCallStepHash, IManagedCallStepYaml } from "./actions/ManagedCallStep";
import { deployManagedCreateStep, getManagedCreateStepHash, IManagedCreateStepYaml } from "./actions/ManagedCreateStep";
import { deployManagedCreate2Step, getManagedCreate2StepHash, IManagedCreate2StepYaml } from "./actions/ManagedCreate2Step";
import { BaseProject, IProjectStepYaml, IProjectYaml, MANAGER_PROJECT, ProjectMode } from "./BaseProject";
import { calculateCreateAddr } from "../utils/CreateAddr";
import { ProjectLoader } from "./ProjectLoader";
import { TTransactionPromise } from "../common/Web3Manager";
import { TransactionReceipt } from "web3-core"
import { TransactionBuilder } from "../common/TransactionBuilder";
import { Logger } from "../common/Logger";
import { renderDate } from "../utils/DateUtils";
import { MessageSigner } from "../common/MessageSigner";

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
  private deploymentSignatures: string[];
  
  public getMode(): ProjectMode {
    return ProjectMode.MANAGED;
  }

  public getProjectAccount(): [string, number] {
    return [this.projectYaml.account.address, this.projectYaml.account.salt];
  }

  public getDeploymentManagerAddress(): string {
    let manager = ProjectLoader.loadProject(MANAGER_PROJECT);
    return manager.resolveExports()["DeploymentManager"];
  }

  public getDeployerAddress(): string {
    return ContractInterface.getDeploymentAccountAddress(
      this.getDeploymentManagerAddress(), 
      this.projectYaml.account.address, 
      this.projectYaml.account.salt
    );
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
    let managerContract = ContractInterface.getDeploymentAccount(this.getDeploymentManagerAddress());
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
        case "create":
          stepRes = await deployManagedCreateStep({
            project: this,
            txbuilder: txbuilder,
            index: stepIdx,
            nonce: stepIdx,
            stepYaml: stepYaml as IManagedCreateStepYaml,
            managerContract: managerContract,
            signature: null,
          });
          break;
        case "create2":
          stepRes = await deployManagedCreate2Step({
            project: this,
            txbuilder: txbuilder,
            index: stepIdx,
            nonce: stepIdx,
            stepYaml: stepYaml as IManagedCreate2StepYaml,
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

  private loadDeploymentSignatures() {
    if(this.deploymentSignatures !== undefined)
      return;
    this.deploymentSignatures = null;

    let signaturesYamlFile = path.join(this.projectPath, "signatures.yaml");
    if(!fs.existsSync(signaturesYamlFile))
      return;
    
    let managerAddr = this.getDeploymentManagerAddress().toLowerCase();
    let signaturesYaml = yaml.parse(fs.readFileSync(signaturesYamlFile, "utf-8"));
    if(!signaturesYaml[managerAddr])
      return;
    
    this.deploymentSignatures = signaturesYaml[managerAddr].signatures;
    let sigtime = new Date(signaturesYaml[managerAddr].signtime * 1000);
    Logger.info("ManagedProject.loadDeploymentSignatures", "loaded deployment signatures for " + this.projectName + " (Signed: " + renderDate(sigtime) + ")");
  }

  public getStepSignature(stepIdx: number): string {
    this.loadDeploymentSignatures();
    if(!this.deploymentSignatures)
      return null;
    if(this.deploymentSignatures.length <= stepIdx)
      return null;
    return this.deploymentSignatures[stepIdx];
  }

  public async generateSignatures(signer: MessageSigner): Promise<string[]> {
    if(!this.projectYaml.steps || this.projectYaml.steps.length == 0)
      return [];

    let signerWallet = signer.getWalletAddress();
    if(signerWallet.toLowerCase() !== this.projectYaml.account.address.toLowerCase()) {
      Logger.error("ManagedProject.generateStepSignature", "cannot generate signatures for `" + this.projectName + "`. project is owned by " + this.projectYaml.account.address + ", but supplied private key is for " + signerWallet);
      return null;
    }

    let managerAddr = this.getDeploymentManagerAddress();
    
    let signatures: string[] = [];
    for(let stepIdx = 0; stepIdx < this.projectYaml.steps.length; stepIdx++) {
      let stepYaml = this.projectYaml.steps[stepIdx] as IManagedProjectStepYaml;
      let stepHash: string;
      switch(stepYaml.action) {
        case "call":
          stepHash = await getManagedCallStepHash(managerAddr, this, stepYaml as IManagedCallStepYaml, stepIdx);
          break;
        case "create":
          stepHash = await getManagedCreateStepHash(managerAddr, this, stepYaml as IManagedCreateStepYaml, stepIdx);
          break;
        case "create2":
          stepHash = await getManagedCreate2StepHash(managerAddr, this, stepYaml as IManagedCreate2StepYaml, stepIdx);
          break;
        default:
          Logger.error("ManagedProject.generateStepSignature", "unknown deployment action `" + stepYaml.action + "` in step " + (stepIdx + 1));
          return null;
      }
      signatures.push(signer.generateSignature(stepHash));
    }

    return signatures;
  }

}

