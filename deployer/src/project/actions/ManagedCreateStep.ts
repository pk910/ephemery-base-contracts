import * as ethers from "ethers"
import { AbiEncoder, IAbiCallYaml } from "../../common/AbiEncoder";
import { Logger } from "../../common/Logger";
import { TTransactionPromise } from "../../common/Web3Manager";
import { IManagedProjectStepYaml, ManagedProject } from "../ManagedProject";
import { ManagedDeploymentStepContext } from "./DeploymentContext";

export interface IManagedCreateStepYaml extends IManagedProjectStepYaml {
  action: "create";
  bytecode: string;
  constructor?: IAbiCallYaml;
  gas?: number;
}

async function resolveStepData(project: ManagedProject, stepYaml: IManagedCreateStepYaml): Promise<{
  code: string;
}> {
  let createCode = "0x" + (stepYaml.bytecode ? project.resolvePlaceholders(stepYaml.bytecode.replace(/^0x/, "")) : "");

  if(stepYaml.constructor && typeof stepYaml.constructor !== "function") {
    createCode += AbiEncoder.encodeConstructorYaml(project, stepYaml.constructor.abi, stepYaml.constructor.args).replace(/^0x/, "");
  }

  return {
    code: createCode
  };
}

export async function deployManagedCreateStep(context: ManagedDeploymentStepContext<ManagedProject, IManagedCreateStepYaml>): Promise<TTransactionPromise> {
  Logger.info("deployManagedCallStep", "step #" + (context.index+1) + " deployment: managed create");

  let stepData = await resolveStepData(context.project, context.stepYaml);

  let managedCallData: string;
  let projectAccount = context.project.getProjectAccount();
  if((await context.txbuilder.getWalletAddress()).toLowerCase() == projectAccount[0].toLowerCase()) {
    // deploy from project owner wallet - use unsigned deployment
    managedCallData = context.managerContract.methods["call"](
      // create(address account, uint account_salt, bytes memory bytecode)
      projectAccount[0],
      projectAccount[1],
      stepData.code
    ).encodeABI();
  }
  else {
    managedCallData = context.managerContract.methods["callFor"](
      // createFor(address account, uint account_salt, bytes memory bytecode, uint128 callNonce, bytes memory signature)
      projectAccount[0],
      projectAccount[1],
      stepData.code,
      context.nonce,
      Buffer.from(context.signature.replace(/^0x/, ""), "hex")
    ).encodeABI();
  }

  let txres = await context.txbuilder.generateTransaction(
    context.managerContract.options.address,
    "0",
    managedCallData,
    context.stepYaml.gas
  );
  return txres;
}

export async function getManagedCreateStepHash(managerAddr: string, project: ManagedProject, stepYaml: IManagedCreateStepYaml, callNonce: number): Promise<string> {
  let projectAccount = project.getProjectAccount();
  let stepData = await resolveStepData(project, stepYaml);

  return ethers.keccak256(ethers.solidityPacked([
    "address",
    "string",
    "address",
    "uint",
    "uint128",
    "bytes"
  ], [
    managerAddr,
    ":create:",
    projectAccount[0],
    projectAccount[1],
    callNonce,
    stepData.code
  ]));
}
