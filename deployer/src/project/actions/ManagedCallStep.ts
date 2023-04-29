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

export async function deployManagedCallStep(context: ManagedDeploymentStepContext<ManagedProject, IManagedCallStepYaml>): Promise<TTransactionPromise> {
  Logger.info("deployManagedCallStep", "step #" + (context.index+1) + " deployment: managed call");

  let callAddr = context.project.resolveReference(context.stepYaml.address);
  let callAmount = "0x"+BigInt(context.stepYaml.amount).toString(16);
  let callData = context.stepYaml.data ? Buffer.from(context.stepYaml.data.replace(/^0x/, ""), "hex") : "0x";

  let managedCallData: string;
  let projectAccount = context.project.getProjectAccount();
  if((await context.txbuilder.getWalletAddress()).toLowerCase() == projectAccount[0].toLowerCase()) {
    // deploy from project owner wallet - use unsigned deployment
    managedCallData = context.managerContract.methods["call"](
      // call(address account, uint account_salt, address addr, uint256 amount, bytes memory data)
      projectAccount[0],
      projectAccount[1],
      callAddr,
      callAmount,
      callData
    ).encodeABI();
  }
  else {
    managedCallData = context.managerContract.methods["callFor"](
      // callFor(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature)
      projectAccount[0],
      projectAccount[1],
      callAddr,
      callAmount,
      callData,
      context.nonce,
      Buffer.from(context.signature.replace(/^0x/, ""), "hex")
    ).encodeABI();
  }

  let txres = await context.txbuilder.generateTransaction(
    context.managerContract.options.address,
    callAmount,
    managedCallData,
    context.stepYaml.gas
  );
  return txres;
}
