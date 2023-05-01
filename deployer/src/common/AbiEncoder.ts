import * as ethers from "ethers"
import { BaseProject } from "../project/BaseProject";

export interface IAbiCallYaml {
  abi: string;
  args: TAbiCallYaml[];
}

export type TAbiCallYaml = IAbiCallYaml | string | string[];

export class AbiEncoder {

  public static encodeFunction(abi: string, args: any[]): string {
    let match = /^(function )?([^ (]+)(\(.*\))/.exec(abi);
    if(!match)
      throw "could not parse abi: " + abi;

    if(!match[1])
      abi = "function " + abi;

    //console.log("encode call: ", abi, args);
    let iface = new ethers.Interface([abi]);
    return iface.encodeFunctionData(match[2], args);
  }

  public static encodeCallYaml(project: BaseProject, callYaml: TAbiCallYaml): string {
    if(typeof callYaml === "string") {
      return project.resolvePlaceholders(callYaml);
    }
    else if(Array.isArray(callYaml)) {
      return callYaml.map((arg) => this.encodeCallYaml(project, arg)) as any;
    }
    else if(callYaml.abi) {
      return this.encodeFunction(callYaml.abi, callYaml.args.map((arg) => this.encodeCallYaml(project, arg)));
    }
    else {
      return callYaml as any;
    }
  }

  public static encodeConstructorYaml(project: BaseProject, abi: string, args: TAbiCallYaml[]): string {
    let iface = new ethers.Interface([abi]);
    let argData = args?.map((arg) => this.encodeCallYaml(project, arg));
    //console.log("encode constructor: ", abi, argData);
    return iface.encodeDeploy(argData);
  }

}
