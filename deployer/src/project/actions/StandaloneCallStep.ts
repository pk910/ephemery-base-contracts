import { Logger } from "../../common/Logger";
import { TTransactionPromise, Web3Manager } from "../../common/Web3Manager";
import { IStandaloneProjectStepYaml, StandaloneProject } from "../StandaloneProject";
import { DeploymentStepContext } from "./DeploymentContext";

export interface IStandaloneCallStepYaml extends IStandaloneProjectStepYaml {
  action: "call";
  address: string;
  amount: string;
  data?: string;
  gas?: number;
}

export async function deployStandaloneCallStep(context: DeploymentStepContext<StandaloneProject, IStandaloneCallStepYaml>): Promise<TTransactionPromise> {
  Logger.info("deployStandaloneCallStep", "step #" + (context.index+1) + " deployment: unmanaged call");
  let txres = await context.txbuilder.generateTransaction(
    context.stepYaml.address,
    context.stepYaml.amount,
    context.stepYaml.data,
    context.stepYaml.gas
  );
  return txres;
}
