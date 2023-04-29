import { TransactionBuilder } from "../../common/TransactionBuilder";
import { BaseProject, IProjectStepYaml } from "../BaseProject";
import { Contract } from 'web3-eth-contract';

export interface DeploymentStepContext<TProject extends BaseProject = null, TStepYaml extends IProjectStepYaml = null> {
  project: TProject;
  txbuilder: TransactionBuilder;
  index: number;
  nonce: number;
  stepYaml: TStepYaml;
}

export interface ManagedDeploymentStepContext<TProject extends BaseProject = null, TStepYaml extends IProjectStepYaml = null> extends DeploymentStepContext<TProject, TStepYaml> {
  managerContract: Contract;
  signature: string;
}
