import { BaseProject, IProjectStepYaml } from "../BaseProject";

export interface DeploymentStepContext<TProject extends BaseProject = null, TStepYaml extends IProjectStepYaml = null> {
  project: TProject;
  index: number;
  nonce: number;
  stepYaml: TStepYaml;
}
