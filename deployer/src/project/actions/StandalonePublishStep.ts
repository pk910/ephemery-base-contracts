import { Logger } from "../../common/Logger";
import { TTransactionPromise, Web3Manager } from "../../common/Web3Manager";
import { IStandaloneProjectStepYaml, StandaloneProject } from "../StandaloneProject";
import { DeploymentStepContext } from "./DeploymentContext";

export interface IStandalonePublishStepYaml extends IStandaloneProjectStepYaml {
  action: "publish";
  transaction: string;
}

export async function deployStandalonePublishStep(context: DeploymentStepContext<StandaloneProject, IStandalonePublishStepYaml>): Promise<TTransactionPromise> {
  Logger.info("deployStandalonePublishStep", "step #" + (context.index+1) + " deployment: unmanaged publish");
  let txres = await Web3Manager.instance.publishTransaction(context.stepYaml.transaction.replace(/^0x/, ""));
  return txres;
}
