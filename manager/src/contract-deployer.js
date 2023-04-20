
const fs = require("fs");
const path = require("path");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const yaml = require("yaml");
const fetch = require("node-fetch");
const FormData = require('form-data');
const RLP = require('rlp');
const Web3 = require('web3');
const ethers = require("ethers");
const EthTx = require('@ethereumjs/tx');
const EthCom = require('@ethereumjs/common');
const EthUtil = require('ethereumjs-util');
const EthWallet = require('ethereumjs-wallet');

const deploymentManagerContract = require("../contract/DeploymentManager.json");

const optionDefinitions = [
  { 
    name: 'project',
    defaultOption: true,
  },
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean
  },
  {
    name: 'verbose',
    description: 'Run the script with verbose output',
    alias: 'v',
    type: Boolean,
  },
  {
    name: 'rpchost',
    description: 'The RPC host to send transactions to.',
    alias: 'r',
    type: String,
    typeLabel: '{underline http://127.0.0.1:8545}',
    defaultValue: 'http://127.0.0.1:8545'
  },
  {
    name: 'privkey',
    description: 'The private key of the deployer wallet.\n(Special: "env" to read from DEPLOYER_PRIVKEY environment variable)',
    alias: 'p',
    type: String,
    typeLabel: '{underline privkey}',
  },
  {
    name: 'maxfeepergas',
    description: 'The maximum fee per gas in gwei.',
    type: Number,
    typeLabel: '{underline 20}',
    defaultValue: 20,
  },
  {
    name: 'maxpriofee',
    description: 'The maximum priority fee per gas in gwei.',
    type: Number,
    typeLabel: '{underline 1.2}',
    defaultValue: 1.2,
  },
  {
    name: 'maxgaslimit',
    description: 'The maximum gaslimit per transaction.',
    type: Number,
    typeLabel: '{underline 10000000}',
    defaultValue: 10000000,
  },
  {
    name: 'verify-sources',
    description: 'Verify contract sources with block explorers.',
    type: Boolean,
  },
];

const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true });

var web3 = null;
var web3Common = null;
var wallet = null;
var deploymentManager = null;

main();

async function main() {
  if(options['help']) {
    printHelp();
    return;
  }

  var walletKey = loadPrivateKey();
  if(!walletKey) {
    printHelp();
    console.log("No wallet privkey specified.");
    console.log("");
    return;
  }

  var walletAddr = EthUtil.toChecksumAddress("0x"+EthUtil.privateToAddress(walletKey).toString("hex"));
  wallet = {
    privkey: walletKey,
    addr: walletAddr,
  };
  
  await deployProject();
}

function printHelp() {
  console.log(commandLineUsage([
    {
      header: 'Contract Deployment Tool',
      content: 'A tool that can be used to deploy pre-defined contracts.'
    },
    {
      header: 'Options',
      optionList: optionDefinitions
    }
  ]));
}

function sleepPromise(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  })
}

function weiToEth(wei) {
  return parseInt((wei / 1000000000000000n).toString()) / 1000;
}

function getGasLimit(limit) {
  if (limit > options['maxgaslimit'])
    limit = options['maxgaslimit'];
  return limit;
}

function loadPrivateKey() {
  if(options['privkey'] === "env" && (process.env.DEPLOYER_PRIVKEY || "").match(/^[0-9a-f]{64}$/i)) {
    return Buffer.from(process.env.DEPLOYER_PRIVKEY, "hex");
  }
  if(options['privkey'] && options['privkey'].match(/^[0-9a-f]{64}$/i)) {
    return Buffer.from(options['privkey'], "hex");
  }
  
  return null;
}

async function startWeb3() {
  try {
    console.log("connecting to web3 rpc: " + options['rpchost']);
    var web3Provider = new Web3.providers.HttpProvider(options['rpchost']);
    web3 = new Web3(web3Provider);
    
    var res = await Promise.all([
      web3.eth.getChainId(),
      web3.eth.getBalance(wallet.addr),
      web3.eth.getTransactionCount(wallet.addr)
    ]);
    wallet.chainid = res[0];
    wallet.balance = BigInt(res[1]);
    wallet.nonce = res[2];
    console.log("wallet " + wallet.addr + " balance: " + weiToEth(wallet.balance) + " ETH [nonce: " + wallet.nonce + "]");
  } catch(ex) {
    console.error("web3 exception: ", ex);
    await sleepPromise(5000);
    await startWeb3();
  }
}

function initWeb3Chain(chainid) {
  console.log("initialize web3 with chainid " + chainid);
  web3Common = EthCom.Common.custom({
    chainId: chainid,
    hardfork: EthCom.Hardfork.London,
  });
}

async function isContract(addr) {
  let code = await web3.eth.getCode(addr);
  return code && !!code.match(/^0x[0-9a-f]{2,}$/);
}

async function getBalance(addr) {
  let balance = await web3.eth.getBalance(addr);
  return parseInt(balance);
}

async function publishTransaction(txhex) {
  var txhashResolve, txhashReject;
  var txhashPromise = new Promise((resolve, reject) => {txhashResolve = resolve; txhashReject = reject; });
  var receiptResolve, receiptReject;
  var receiptPromise = new Promise((resolve, reject) => {receiptResolve = resolve; receiptReject = reject; });
  var txStatus = 0;

  var txPromise = web3.eth.sendSignedTransaction("0x" + txhex);
  txPromise.once('transactionHash', (hash) => {
    txStatus = 1;
    txhashResolve(hash);
  });
  txPromise.once('receipt', (receipt) => {
    txStatus = 2;
    receiptResolve(receipt);
  });
  txPromise.on('error', (error) => {
    if(txStatus === 0)
      txhashReject(error);
    else
      receiptReject(error);
  });

  let txHash = await txhashPromise;
  return [txHash, receiptPromise];
}

async function deployProject() {
  await startWeb3();
  initWeb3Chain(wallet.chainid);

  if(!options['project']) {
    console.log("missing project name.");
    return;
  }

  // load project
  var projectPath = path.join(".", "projects", options['project']);
  if(!fs.existsSync(path.join(projectPath, "deployment.yaml"))) {
    console.log("could not find deployment.yaml in " + projectPath);
    return;
  }
  var projectYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "deployment.yaml"), "utf-8"));
  var projectRefs = {};

  // load & check dependencies
  if(projectYaml.dependencies && Array.isArray(projectYaml.dependencies) && projectYaml.dependencies.length > 0) {
    let allValid = true;
    for(let i = 0; i < projectYaml.dependencies.length; i++) {
      allValid = allValid && await checkProjectDependency(projectYaml.dependencies[i], projectRefs);
    }
    if(!allValid) {
      console.log("one or more dependency checks failed!");
      return;
    }
  }

  switch(projectYaml.mode) {
    case "unmanaged":
    case "standalone":
      await deployStandaloneProject(projectPath, projectYaml, projectRefs);
      break;
    case "managed":
      await deployManagedProject(projectPath, projectYaml, projectRefs);
      break;
  }

  console.log("");

  if(!(await checkProjectDependency(options['project'], projectRefs))) {
    console.log("Deployment completed, but dependency check still fails");
    return;
  }

  if(options['verify-sources']) {
    await verifyContractSources(projectPath, projectYaml);
  }

  console.log("Project references:");
  console.log(yaml.stringify(projectRefs));

}

async function deployStandaloneProject(projectPath, projectYaml, projectRefs) {
  // run deployment steps
  if(!projectYaml.steps || !Array.isArray(projectYaml.steps) || projectYaml.steps.length == 0) {
    console.log("no deployment steps for " + options['project']);
    return;
  }

  var deploymentPromises = [];
  for(let i = 0; i < projectYaml.steps.length; i++) {
    let step = projectYaml.steps[i];
    if(step.if && !(await checkProjectStepConditions(projectRefs, step.if))) {
      console.log("deployment step " + (i+1) + " skipped: conditions not met");
      continue;
    }

    let res;
    switch(step.action) {
      case "publish":
        res = await runDeploymentPublishStep(projectYaml, i, step, projectRefs);
        break;
      case "call":
        res = await runDeploymentCallStep(projectYaml, i, step, projectRefs);
        break;
    }
    if(res) {
      if(res[0])
        console.log(" tx hash: " + res[0]);
      deploymentPromises.push(res[1]);

      if(step.await && res[1]) {
        console.log(" awaiting confirmation...");
        await res[1];
      }
    }
  }

  console.log("deployment completed, awaiting confirmations...");
  await Promise.all(deploymentPromises);
  console.log("all transactions confirmed!");
}

async function deployManagedProject(projectPath, projectYaml, projectRefs) {
  if(!fs.existsSync(path.join(projectPath, "signatures.yaml"))) {
    console.log("could not find signatures.yaml in " + projectPath);
    return;
  }
  var signaturesYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "signatures.yaml"), "utf-8"));

  if(!deploymentManager) {
    if(!(await checkProjectDependency("_manager", projectRefs))) {
      console.log("DeplomentManager not found. Please deploy '_manager' project first.");
      return;
    }
    deploymentManager = new web3.eth.Contract(deploymentManagerContract.managerAbi, projectRefs["_manager.DeploymentManager"]);
  }

  if(!(signaturesYaml = signaturesYaml[projectRefs["_manager.DeploymentManager"].toLowerCase()])) {
    console.log("could not find valid signatures to use with DeploymentManager at " + projectRefs["_manager.DeploymentManager"]);
    return;
  }

  // check if already deployed
  var skipSteps = 0;
  var deployerAddr = await deploymentManager.methods["getDeployer"](projectYaml.account.address, projectYaml.account.salt).call();
  if(deployerAddr && !deployerAddr.match(/^0x0+$/)) {
    var deployerContract = new web3.eth.Contract(deploymentManagerContract.accountAbi, deployerAddr);
    var deployerCallNonce = await deployerContract.methods["callNonce"]().call();
    if(deployerCallNonce >= projectYaml.steps.length) {
      console.log("project " + options['project'] + " is already deployed!");
      return;
    }
    else if(deployerCallNonce > 0) {
      console.log("project " + options['project'] + " is deployed incompletely... Trying to continue with step " + deployerCallNonce);
      skipSteps = deployerCallNonce;
    }
  }
  

  // load & check dependencies
  if(projectYaml.dependencies && Array.isArray(projectYaml.dependencies) && projectYaml.dependencies.length > 0) {
    let allValid = true;
    for(let i = 0; i < projectYaml.dependencies.length; i++) {
      allValid = allValid && await checkProjectDependency(projectYaml.dependencies[i], projectRefs);
    }
    if(!allValid) {
      console.log("one or more dependency checks failed!");
      return;
    }
  }

  // run deployment steps
  if(!projectYaml.steps || !Array.isArray(projectYaml.steps) || projectYaml.steps.length == 0) {
    console.log("no deployment steps for " + options['project']);
    return;
  }
  if(!signaturesYaml.signatures || !Array.isArray(signaturesYaml.signatures) || signaturesYaml.signatures.length !== projectYaml.steps.length) {
    console.log("number of signatures does not match number of steps for " + options['project']);
    return;
  }

  var deploymentPromises = [];
  for(let i = skipSteps; i < projectYaml.steps.length; i++) {
    let step = projectYaml.steps[i];
    // conditions not supported in managed mode as that breaks the callNonce restriction. Need to add a signed replacement transaction if this is really needed.
    //if(step.if && !(await checkProjectStepConditions(projectRefs, step.if))) {
    //  console.log("deployment step " + idx + " skipped: conditions not met");
    //}
    
    let res;
    switch(step.action) {
      case "create":
        res = await runDeploymentCreateStep(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
      case "create2":
        res = await runDeploymentCreate2Step(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
      case "call":
        res = await runDeploymentManagedCallStep(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
    }
    if(res) {
      if(res[0])
        console.log(" tx hash: " + res[0]);
      deploymentPromises.push(res[1]);

      if(step.await && res[1]) {
        console.log(" awaiting confirmation...");
        await res[1];
      }
    }
  }

  console.log("deployment completed, awaiting confirmations...");
  await Promise.all(deploymentPromises);
  console.log("all transactions confirmed!");
}

async function checkProjectStepConditions(projectRefs, conditions) {
  if(!conditions)
    return true;
  if(!Array.isArray(conditions))
    conditions = [ conditions ];

  for(let i = 0; i < conditions.length; i++) {
    let condition = conditions[i];
    let [leftSide, rightSide] = await Promise.all([
      getProjectStepConditionTermValue(projectRefs, condition[0]),
      getProjectStepConditionTermValue(projectRefs, condition[2]),
    ]);
    switch(condition[1]) {
      case ">": if(!(leftSide > rightSide)) return false; break;
      case ">=": if(!(leftSide >= rightSide)) return false; break;
      case "<": if(!(leftSide < rightSide)) return false; break;
      case "<=": if(!(leftSide <= rightSide)) return false; break;
      case "==": if(!(leftSide == rightSide)) return false; break;
      default:
        console.log("invalid condition operator: " + condition[1]);
        return false;
    }
  }

  return true;
}

async function getProjectStepConditionTermValue(projectRefs, term) {
  let fnmatch;
  if((fnmatch = /^([^()]*)\(([^)]+)\)$/.exec(term))) {
    let fnargs = fnmatch[2].split(",");
    switch(fnmatch[1]) {
      case "balance":
        return await getBalance.apply(this, fnargs);
      case "iscontract":
        return await isContract.apply(this, fnargs);
      default:
        console.log("invalid condition term fn: " + fnmatch[1]);
        return null;
    }
  }
  
  if(term === "true")
    return true;
  else if(term === "false")
    return false;
  else if(/^[0-9]+$/.exec(term))
    return parseFloat(term);
  else
    return term;
}

async function checkProjectDependency(projectName, projectRefs) {
  var projectPath = path.join(".", "projects", projectName);
  if(!fs.existsSync(path.join(projectPath, "deployment.yaml"))) {
    console.log("dependency check for " + projectName + " failed: could not find deployment.yaml in " + projectPath);
    return false;
  }
  var projectYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "deployment.yaml"), "utf-8"));

  switch(projectYaml.mode) {
    case "unmanaged":
    case "standalone":
      return await checkStandaloneProjectDependency(projectName, projectYaml, projectRefs);
    case "managed":
      return await checkManagedProjectDependency(projectName, projectYaml, projectRefs);
  }
}

async function checkStandaloneProjectDependency(projectName, projectYaml, projectRefs) {
  // collect exports
  var exportKeys;
  var allValid = true;
  if(projectRefs && projectYaml.exports && (exportKeys = Object.keys(projectYaml.exports)).length > 0) {
    for(let i = 0; i < exportKeys.length; i++) {
      let exportKey = exportKeys[i];
      let exportRef = projectYaml.exports[exportKey].split(":");
      switch(exportRef[0]) {
        case "contract":
          projectRefs[projectName + "." + exportKey] = exportRef[1];
          if(!(await isContract(exportRef[1]))) {
            allValid = false;
            console.log("dependency check for " + projectName + " failed: contract " + exportKey + " not found at " + exportRef[1]);
          }
          break;
        default:
          break;
      }
    }
  }

  return allValid;
}

async function checkManagedProjectDependency(projectName, projectYaml, projectRefs) {
  if(!projectYaml.steps || !Array.isArray(projectYaml.steps) || projectYaml.steps.length == 0) {
    console.log("dependency check for " + projectName + " skipped: no deployment steps in project");
    return true;
  }

  if(!deploymentManager) {
    if(!(await checkProjectDependency("_manager", projectRefs))) {
      console.log("dependency check for " + projectName + " failed: could not check managed dependency without DeploymentManager. Please deploy '_manager' project first!");
      return false;
    }
    deploymentManager = new web3.eth.Contract(deploymentManagerContract.managerAbi, projectRefs["_manager.DeploymentManager"]);
  }

  // collect exports
  var exportKeys;
  if(projectRefs && projectYaml.exports && (exportKeys = Object.keys(projectYaml.exports)).length > 0) {
    for(let i = 0; i < exportKeys.length; i++) {
      let exportKey = exportKeys[i];
      let exportRef = projectYaml.exports[exportKey].split(":");
      let exportVal;
      switch(exportRef[0]) {
        case "create":
          exportVal = await deploymentManager.methods["getCreateAddress"](projectYaml.account.address, projectYaml.account.salt, parseInt(exportRef[1])).call();
          if(exportRef.length > 2) {
            for(let ridx = 2; ridx < exportRef.length; ridx++) {
              exportVal = resolveCreateAddr(exportVal, parseInt(exportRef[ridx]));
            }
          }
          projectRefs[projectName + "." + exportKey] = exportVal;
          break;
        default:
          break;
      }
    }
  }

  // check if dependency is fully deployed
  var deployerAddr = await deploymentManager.methods["getDeployer"](projectYaml.account.address, projectYaml.account.salt).call();
  if(!deployerAddr || deployerAddr.match(/^0x0+$/)) {
    console.log("dependency check for " + projectName + " failed: deployer wallet not found");
    return false;
  }

  var deployerContract = new web3.eth.Contract(deploymentManagerContract.accountAbi, deployerAddr);
  var deployerCallNonce = await deployerContract.methods["callNonce"]().call();
  if(deployerCallNonce < projectYaml.steps.length) {
    console.log("dependency check for " + projectName + " failed: not fully deployed (call nonce: " + deployerCallNonce + ", steps: " + projectYaml.steps.length + ")");
    return false;
  }

  return true;
}

function resolveCreateAddr(addr, nonce) {
  var data;
  if (nonce == 0x00) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1"], 
      ["0xd6", "0x94", addr, "0x80"]
    );
  else if (nonce <= 0x7f) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1"], 
      ["0xd6", "0x94", addr, "0x"+nonce.toString(16).padStart(2, "0")]
    );
  else if (nonce <= 0xff) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint8"], 
      ["0xd7", "0x94", addr, "0x81", "0x"+nonce.toString(16).padStart(2, "0")]
    );
  else if (nonce <= 0xffff) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint16"], 
      ["0xd8", "0x94", addr, "0x82", "0x"+nonce.toString(16).padStart(4, "0")]
    );
  else if (nonce <= 0xffffff)
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint24"], 
      ["0xd9", "0x94", addr, "0x83", "0x"+nonce.toString(16).padStart(6, "0")]
    );
  else 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint32"], 
      ["0xda", "0x94", addr, "0x84", "0x"+nonce.toString(16).padStart(8, "0")]
    );
  
  var dataHash = ethers.keccak256(data);
  var createAddr = "0x" + dataHash.substring(dataHash.length - 40);
  return Web3.utils.toChecksumAddress(createAddr);
}

async function runDeploymentCreateStep(projectYaml, idx, step, signature, projectRefs) {
  console.log("deployment step " + (idx+1) + ": create");

  var callData = deploymentManager.methods["createFor"](
    // createFor(address account, uint account_salt, bytes memory bytecode, uint128 callNonce, bytes memory signature)
    projectYaml.account.address,
    projectYaml.account.salt,
    Buffer.from(step.bytecode.replace(/^0x/, ""), "hex"),
    idx,
    Buffer.from(signature.replace(/^0x/, ""), "hex")
  ).encodeABI();

  //console.log(callData);

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: getGasLimit(step.gas || projectYaml.gas || 10000000),
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: projectRefs["_manager.DeploymentManager"],
    value: 0,
    data: callData
  };

  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);

  var txhex = tx.serialize().toString('hex');
  var txres = await publishTransaction(txhex);
  wallet.nonce++;

  return txres;
}

async function runDeploymentCreate2Step(projectYaml, idx, step, signature, projectRefs) {
  console.log("deployment step " + (idx+1) + ": create2");

  var callData = deploymentManager.methods["create2For"](
    // create2For(address account, uint account_salt, uint salt, bytes memory bytecode, uint128 callNonce, bytes memory signature)
    projectYaml.account.address,
    projectYaml.account.salt,
    step.salt || 1,
    Buffer.from(step.bytecode.replace(/^0x/, ""), "hex"),
    idx,
    Buffer.from(signature.replace(/^0x/, ""), "hex")
  ).encodeABI();

  //console.log(callData);

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: getGasLimit(step.gas || projectYaml.gas || 10000000),
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: projectRefs["_manager.DeploymentManager"],
    value: 0,
    data: callData
  };

  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);

  var txhex = tx.serialize().toString('hex');
  var txres = await publishTransaction(txhex);
  wallet.nonce++;

  return txres;
}

async function runDeploymentManagedCallStep(projectYaml, idx, step, signature, projectRefs) {
  console.log("deployment step " + (idx+1) + ": call");

  var callData = deploymentManager.methods["callFor"](
    // callFor(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature)
    projectYaml.account.address,
    projectYaml.account.salt,
    step.address,
    "0x" + (step.amount || 0).toString(16),
    step.data ? Buffer.from(step.data.replace(/^0x/, ""), "hex") : "0x",
    idx,
    Buffer.from(signature.replace(/^0x/, ""), "hex")
  ).encodeABI();

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: getGasLimit(step.gas || projectYaml.gas || 10000000),
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: projectRefs["_manager.DeploymentManager"],
    value: 0,
    data: callData
  };

  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);

  var txhex = tx.serialize().toString('hex');
  var txres = await publishTransaction(txhex);
  wallet.nonce++;

  return txres;
}

async function runDeploymentPublishStep(projectYaml, idx, step, projectRefs) {
  console.log("deployment step " + (idx+1) + ": publish");
  if(!step.transaction)
    return;
  return await publishTransaction(step.transaction.replace(/^0x/, ""));
}

async function runDeploymentCallStep(projectYaml, idx, step, projectRefs) {
  console.log("deployment step " + (idx+1) + ": unmanaged call");

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: getGasLimit(step.gas || projectYaml.gas || 10000000),
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: step.address,
    value: "0x" + (step.amount || 0).toString(16),
    data: step.data ? Buffer.from(step.data.replace(/^0x/, ""), "hex") : "0x"
  };

  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);

  var txhex = tx.serialize().toString('hex');
  var txres = await publishTransaction(txhex);
  wallet.nonce++;

  return txres;
}

async function verifyContractSources(projectPath, projectYaml) {
  var verifyContracts = projectYaml['code-verify'] ? Object.keys(projectYaml['code-verify']) : [];
  if(verifyContracts.length == 0)
    return;

  // load explorers.yaml
  if(!fs.existsSync("explorers.yaml")) {
    console.log("could not find explorers.yaml");
    return;
  }
  var explorersYaml = yaml.parse(fs.readFileSync("explorers.yaml", "utf-8"));
  var explorers = explorersYaml.explorers || [];
  if(explorers.length == 0)
    return;

  for(let cIdx = 0; cIdx < verifyContracts.length; cIdx++) {
    let codeInput = projectYaml['code-verify'][verifyContracts[cIdx]];
    try {
      codeInput.inputData = fs.readFileSync(path.join(projectPath, codeInput.input), "utf-8");
    } catch(ex) {
      console.log("could not find input json for " + verifyContracts[cIdx]);
      continue;
    }

    for(let eIdx = 0; eIdx < explorers.length; eIdx++) {
      let explorer = explorers[eIdx];
      try {
        let res;
        switch(explorer.type) {
          case "blockscout":
          case "etherscan":
            res = await verifyEtherscanSource(explorer, verifyContracts[cIdx], codeInput);
            break;
          case "blockscout-alt":
            res = await verifyBlockscoutSource(explorer, verifyContracts[cIdx], codeInput, projectPath);
            break;
          default:
            res = null;
            break;
        }
        console.log("sent contract source for " + verifyContracts[cIdx] + " to " + explorer.url + ":", res);
      } catch(ex) {
        console.log("error while verifying contract source for " + verifyContracts[cIdx] + " with " + explorer.url + ": " + ex.toString());
      }
    }
  }
}

async function verifyEtherscanSource(explorer, contractAddr, codeInput) {
  let rsp = await fetch(explorer.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: encodeFormBody({
      "module": "contract",
      "action": "verifysourcecode",
      "codeformat": "solidity-standard-json-input",
      "contractaddress": contractAddr,
      "contractname": codeInput.contract,
      "compilerversion": codeInput.compiler,
      "sourceCode": codeInput.inputData
    })
  });
  return await rsp.json();
}

async function verifyBlockscoutSource(explorer, contractAddr, codeInput, projectPath) {
  let csrfRsp = await fetch(explorer.url + "/address/" + contractAddr + "/verify-via-standard-json-input/new");
  let csrfText = await csrfRsp.text();
  let csrfMatch = /<input name="_csrf_token" [^>]*value="([^"]+)">/.exec(csrfText);
  let csrfToken = csrfMatch ? csrfMatch[1] : null;

  console.log("csrfToken ", csrfToken);

  let formData = new FormData();
  formData.append("address_hash", contractAddr);
  formData.append("verification_type", "json:standard");
  formData.append("_csrf_token", csrfToken);
  formData.append("smart_contract[address_hash]", contractAddr);
  formData.append("smart_contract[name]", codeInput.contract);
  formData.append("smart_contract[nightly_builds]", "false");
  formData.append("smart_contract[compiler_version]", codeInput.compiler);
  formData.append("smart_contract[autodetect_constructor_args]", "true");
  formData.append("smart_contract[constructor_arguments]", "");
  formData.append("button", "");
  formData.append("file[0]", fs.createReadStream(path.join(projectPath, codeInput.input)));

  let rsp = await fetch(explorer.url + "/verify_smart_contract/contract_verifications", {
    method: 'POST',
    body: formData
  });
  console.log(rsp);
  let rspJson = await rsp.json();
  console.log(rspJson);
  return rspJson;
}

function encodeFormBody(data) {
  var formBody = [];
  for (var property in data) {
    var encodedKey = encodeURIComponent(property);
    var encodedValue = encodeURIComponent(data[property]);
    formBody.push(encodedKey + "=" + encodedValue);
  }
  console.log(formBody.join("&"));
  return formBody.join("&");
}
