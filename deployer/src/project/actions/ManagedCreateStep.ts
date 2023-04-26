import { IProjectStepYaml } from "../BaseProject";
import { IManagedProjectStepYaml } from "../ManagedProject";

export interface IManagedCreateStepYaml extends IManagedProjectStepYaml {
  action: "create";

}
