import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export interface IExplorerYaml {
  url: string;
  type: string;
}

export type TCodeInputYaml = ICodeInputSolYaml | ICodeInputJsonYaml;

export interface ICodeInputSolYaml {
  code: string;
  compiler: string;
  optimize: number | false;
  contract: string;
  evmver?: string;
}

export interface ICodeInputJsonYaml {
  input: string;
  compiler: string;
  contract: string;
}

export class ExplorerCodeVerifier {

  public static async verifyProjectSource(contractAddr: string, codeInput: TCodeInputYaml, explorer: IExplorerYaml, projectPath: string) {
    try {
      let res;
      switch(explorer.type) {
        case "blockscout":
        case "etherscan":
          if((codeInput as any).input)
            res = await this.verifyEtherscanSourceInput(explorer, contractAddr, codeInput as ICodeInputJsonYaml, projectPath);
          else
            res = await this.verifyEtherscanSourceCode(explorer, contractAddr, codeInput as ICodeInputSolYaml, projectPath);
          break;
        //case "blockscout-alt":
        //  res = await this.verifyBlockscoutSource(explorer, verifyContracts[cIdx], codeInput, projectPath);
        //  break;
        default:
          res = null;
          break;
      }
      console.log("verify contract source for " + contractAddr + " (" + codeInput.contract + ") on " + explorer.url + ":", res);
      return res;
    } catch(ex) {
      console.log("error while verifying contract source for " + contractAddr + " (" + codeInput.contract + ") with " + explorer.url + ": " + ex.toString(), ex.stack);
      return "error";
    }
  }

  private static async verifyEtherscanSourceInput(explorer: IExplorerYaml, contractAddr: string, codeInput: ICodeInputJsonYaml, projectPath: string): Promise<string> {
    let inputData = fs.readFileSync(path.join(projectPath, codeInput.input), "utf-8");
    let rsp = await fetch(explorer.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: this.encodeFormBody({
        "module": "contract",
        "action": "verifysourcecode",
        "codeformat": "solidity-standard-json-input",
        "contractaddress": contractAddr,
        "contractname": codeInput.contract,
        "compilerversion": codeInput.compiler,
        "sourceCode": inputData,
        "autodetectConstructorArguments": 1
      })
    });
    let rspJson: any = await rsp.json();
    if(rspJson.status == "1")
      return "OK";
    if(rspJson.message && rspJson.message.match(/already verified/))
      return "already verified";
    
    return rspJson;
  }

  private static async verifyEtherscanSourceCode(explorer: IExplorerYaml, contractAddr: string, codeInput: ICodeInputSolYaml, projectPath: string): Promise<string> {
    let codeData = fs.readFileSync(path.join(projectPath, codeInput.code), "utf-8");;
    let rsp = await fetch(explorer.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: this.encodeFormBody({
        "module": "contract",
        "action": "verify",
        "addressHash": contractAddr,
        "name": codeInput.contract,
        "compilerVersion": codeInput.compiler,
        "optimization": codeInput.optimize ? true : false,
        "optimizationRuns": codeInput.optimize ? codeInput.optimize : 0,
        "evmVersion": codeInput.evmver || "default",
        "contractSourceCode": codeData,
        "autodetectConstructorArguments": true
      })
    });
    let rspJson: any = await rsp.json();
    if(rspJson.status == "1")
      return "OK";
    if(rspJson.message && rspJson.message.match(/already verified/))
      return "already verified";
    
    return rspJson;
  }

  /*
  private static async verifyBlockscoutSource(explorer: IExplorerYaml, contractAddr: string, codeInput: ICodeInputSolYaml, projectPath: string): Promise<string> {
    let csrfRsp = await fetch(explorer.url + "/address/" + contractAddr + "/verify-via-standard-json-input/new");
    let csrfText = await csrfRsp.text();
    let csrfMatch = /<input name="_csrf_token" [^>]*value="([^"]+)">/.exec(csrfText);
    let csrfToken = csrfMatch ? csrfMatch[1] : null;
    if(!csrfToken) {
      if(csrfText.match(/Verified at/))
        return "already verified";
  
      throw "no csrf token";
    }
  
    let formData = new FormData();
    formData.append("_csrf_token", csrfToken);
    formData.append("smart_contract[address_hash]", contractAddr);
    formData.append("smart_contract[name]", codeInput.contract);
    formData.append("smart_contract[nightly_builds]", "false");
    formData.append("smart_contract[compiler_version]", codeInput.compiler);
  
    if(codeInput.constructor) {
      formData.append("smart_contract[autodetect_constructor_args]", "false");
      formData.append("smart_contract[constructor_arguments]", codeInput.constructor);
    }
    else {
      formData.append("smart_contract[autodetect_constructor_args]", "true");
      formData.append("smart_contract[constructor_arguments]", "");
    }
  
    if(codeInput.input) {
      formData.append("address_hash", contractAddr);
      formData.append("verification_type", "json:standard");
      formData.append("button", "");
      formData.append("file[0]", fs.createReadStream(path.join(projectPath, codeInput.input)));
  
      await fetch(explorer.url + "/verify_smart_contract/contract_verifications", {
        method: 'POST',
        body: formData
      });
      return "success (json-input)";
    }
    else {
      formData.append("smart_contract[evm_version]", codeInput.evmver || "default");
      formData.append("smart_contract[optimization]", codeInput.optimize ? "true" : "false");
      formData.append("smart_contract[optimization_runs]", codeInput.optimize ? codeInput.optimize : "0");
      formData.append("smart_contract[contract_source_code]", codeInput.codeData);
  
      await fetch(explorer.url + "/verify_smart_contract/contract_verifications", {
        method: 'POST',
        body: formData
      });
      return "success (code-input)";
    }
  }
  */
  
  private static encodeFormBody(data: any): string {
    var formBody = [];
    for (var property in data) {
      var encodedKey = encodeURIComponent(property);
      var encodedValue = encodeURIComponent(data[property]);
      formBody.push(encodedKey + "=" + encodedValue);
    }
    //console.log(formBody.join("&"));
    return formBody.join("&");
  }  

}

