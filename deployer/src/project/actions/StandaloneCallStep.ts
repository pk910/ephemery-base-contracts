import { IStandaloneProjectStepYaml, StandaloneProject } from "../StandaloneProject";
import { DeploymentStepContext } from "./DeploymentContext";

export interface IStandaloneCallStepYaml extends IStandaloneProjectStepYaml {
  action: "call";

}

export async function deployStandaloneCallStep(context: DeploymentStepContext<StandaloneProject, IStandaloneCallStepYaml>): Promise<void> {

}
