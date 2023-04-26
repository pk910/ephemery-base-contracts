import { IProjectStepYaml } from "../BaseProject";
import { IManagedProjectStepYaml } from "../ManagedProject";

export interface IManagedCallStepYaml extends IManagedProjectStepYaml {
  action: "call";

}
