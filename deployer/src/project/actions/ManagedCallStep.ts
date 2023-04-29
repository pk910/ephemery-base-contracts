import * as ethers from "ethers"
import { Logger } from "../../common/Logger";
import { TTransactionPromise } from "../../common/Web3Manager";
import { IManagedProjectStepYaml, ManagedProject } from "../ManagedProject";
import { ManagedDeploymentStepContext } from "./DeploymentContext";

export interface IManagedCallStepYaml extends IManagedProjectStepYaml {
  action: "call";
  address: string;
  amount: string;
  data?: string;
  gas?: number;
}

async function resolveStepData(project: ManagedProject, stepYaml: IManagedCallStepYaml): Promise<{
  addr: string;
  amount: string;
  data: string;
}> {
  let callAddr = project.resolveReference(stepYaml.address);
  let callAmount = "0x" + BigInt(stepYaml.amount).toString(16);
  let callData = "0x" + (stepYaml.data ? stepYaml.data.replace(/^0x/, "") : "");

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
