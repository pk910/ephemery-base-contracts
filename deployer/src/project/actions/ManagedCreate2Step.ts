import { IProjectStepYaml } from "../BaseProject";
import { IManagedProjectStepYaml } from "../ManagedProject";

export interface IManagedCreate2StepYaml extends IManagedProjectStepYaml {
  action: "create";

}
