import * as ethers from "ethers"
import { AbiEncoder, IAbiCallYaml } from "../../common/AbiEncoder";
import { Logger } from "../../common/Logger";
import { TTransactionPromise } from "../../common/Web3Manager";
import { IManagedProjectStepYaml, ManagedProject } from "../ManagedProject";
import { ManagedDeploymentStepContext } from "./DeploymentContext";

export interface IManagedCallStepYaml extends IManagedProjectStepYaml {
  action: "call";
  address: string;
  amount: string;
  data?: string;
  call?: IAbiCallYaml;
  gas?: number;
}

async function resolveStepData(project: ManagedProject, stepYaml: IManagedCallStepYaml): Promise<{
  addr: string;
  amount: string;
  data: string;
}> {
  let callAddr = project.resolvePlaceholders(stepYaml.address);
  let callAmount = "0x" + BigInt(project.resolvePlaceholders(stepYaml.amount)).toString(16);
  let callData: string = "0x";
  if(stepYaml.data) {
    callData = "0x" + project.resolvePlaceholders(stepYaml.data.replace(/^0x/, ""));
  }
  else if(stepYaml.call) {
    callData = AbiEncoder.encodeCallYaml(project, stepYaml.call);
  }

  return {
    addr: callAddr,
    amount: callAmount,
    data: callData,
  };
}

export async function deployManagedCallStep(context: ManagedDeploymentStepContext<ManagedProject, IManagedCallStepYaml>): Promise<TTransactionPromise> {
  Logger.info("deployManagedCallStep", "step #" + (context.index+1) + " deployment: managed call");

  let stepData = await resolveStepData(context.project, context.stepYaml);

  let managedCallData: string;
  let projectAccount = context.project.getProjectAccount();
  if((await context.txbuilder.getWalletAddress()).toLowerCase() == projectAccount[0].toLowerCase()) {
    // deploy from project owner wallet - use unsigned deployment
    managedCallData = context.managerContract.methods["call"](
      // call(address account, uint account_salt, address addr, uint256 amount, bytes memory data)
      projectAccount[0],
      projectAccount[1],
      stepData.addr,
      stepData.amount,
      stepData.data
    ).encodeABI();
  }
  else {
    managedCallData = context.managerContract.methods["callFor"](
      // callFor(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature)
      projectAccount[0],
      projectAccount[1],
      stepData.addr,
      stepData.amount,
      stepData.data,
      context.nonce,
      Buffer.from(context.signature.replace(/^0x/, ""), "hex")
    ).encodeABI();
  }

  let txres = await context.txbuilder.generateTransaction(
    context.managerContract.options.address,
    stepData.amount,
    managedCallData,
    context.stepYaml.gas
  );
  return txres;
}

export async function getManagedCallStepHash(managerAddr: string, project: ManagedProject, stepYaml: IManagedCallStepYaml, callNonce: number): Promise<string> {
  let projectAccount = project.getProjectAccount();
  let stepData = await resolveStepData(project, stepYaml);

  return ethers.keccak256(ethers.solidityPacked([
    "address",
    "string",
    "address",
    "uint",
    "uint128",
    "address",
    "uint",
    "bytes"
  ], [
    managerAddr,
    ":call:",
    projectAccount[0],
    projectAccount[1],
    callNonce,
    stepData.addr,
    stepData.amount,
    stepData.data
  ]));
}
