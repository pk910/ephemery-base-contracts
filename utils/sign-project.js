
const fs = require("fs");
const yaml = require("yaml");
const ethers = require("ethers");
const readline = require("readline");

(async function() {
  console.log("Sign project deployment");
  console.log("");

  var projectName = process.argv[process.argv.length-1];
  if(!projectName) {
    console.error("Please specify a project name.");
    process.exit();
  }

  if(!fs.existsSync("./projects/" + projectName + "/deployment.yaml")) {
    console.error("./projects/" + projectName + "/deployment.yaml not found.");
    process.exit();
  }

  var projectYaml = yaml.parse(fs.readFileSync("./projects/" + projectName + "/deployment.yaml", "utf8"));
  //console.log(projectYaml);

  console.log("Project: " + projectName);
  console.log("Owner address: " + projectYaml.account.address);
  console.log("");
  function promptPrivKey() {
    return new Promise((resolve) => {
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.stdoutMuted = true;
      rl.question('Please enter the private key for ' + projectYaml.account.address + ': \n', function(password) {
        resolve(password);
        rl.close();
      });
    
      rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.stdoutMuted)
          rl.output.write("*");
        else
          rl.output.write(stringToWrite);
      };
    });
  }
  var privKeyStr = await promptPrivKey();
  console.log("");
  console.log("");

  if(!privKeyStr.match(/^0x/))
    privKeyStr = "0x" + privKeyStr;
  var privKey = new ethers.SigningKey(privKeyStr);

  var deploymentSteps = projectYaml.steps;
  if(!Array.isArray(deploymentSteps) || deploymentSteps.length === 0) {
    console.error("Project has no deployment steps. Nothing to sign :)");
    process.exit();
  }

  var deploymentSigs = [];
  var callNonce = 0;
  for(var i = 0; i < deploymentSteps.length; i++) {
    console.log("Signing step " + (i+1) + ": " + deploymentSteps[i].action);

    let stepHash = null;
    switch(deploymentSteps[i].action.toLowerCase()) {
      case "create":
        // keccak256(abi.encodePacked("create:", account, account_salt, nonce, bytecode))
        stepMessage = ethers.solidityPacked([
          "string",
          "address",
          "uint",
          "uint128",
          "bytes"
        ], [
          "create:",
          projectYaml.account.address,
          projectYaml.account.salt,
          callNonce,
          Buffer.from(deploymentSteps[i].bytecode, "hex")
        ]);
        break;
      case "create2":
        // keccak256(abi.encodePacked("create2:", account, account_salt, nonce, salt, bytecode))
        stepMessage = ethers.solidityPacked([
          "string",
          "address",
          "uint",
          "uint128",
          "uint",
          "bytes"
        ], [
          "create2:",
          projectYaml.account.address,
          projectYaml.account.salt,
          callNonce,
          deploymentSteps[i].salt,
          Buffer.from(deploymentSteps[i].bytecode, "hex")
        ]);
        break;
      case "call":
        // keccak256(abi.encodePacked("call:", account, account_salt, nonce, addr, amount, data))
        stepMessage = ethers.solidityPacked([
          "string",
          "address",
          "uint",
          "uint128",
          "address",
          "uint",
          "bytes"
        ], [
          "call:",
          projectYaml.account.address,
          projectYaml.account.salt,
          callNonce,
          deploymentSteps[i].address,
          deploymentSteps[i].amount,
          Buffer.from(deploymentSteps[i].data, "hex")
        ]);
        break;
      default:
        console.error("Unknown action '" + deploymentSteps[i].action + "' in step " + (i+1));
        process.exit();
    }
    stepHash = ethers.keccak256(stepMessage);
    console.log("  message hash: " + stepHash);

    var ethMsg = ethers.solidityPacked([
      "string",
      "bytes32"
    ], [
      "\x19Ethereum Signed Message:\n32",
      stepHash
    ]);
    var ethMsgHash = ethers.keccak256(ethMsg);
    var stepSig = privKey.sign(ethMsgHash);
    console.log("  signature: " + stepSig.serialized);

    deploymentSigs.push(stepSig.serialized);
  }

  var sigYaml = yaml.stringify({
    signatures: deploymentSigs
  },
  { lineWidth: 0 });
  fs.writeFileSync("./projects/" + projectName + "/signatures.yaml", sigYaml);

})();
