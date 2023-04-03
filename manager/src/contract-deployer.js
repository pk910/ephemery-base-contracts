
const fs = require("fs");
const path = require("path");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const yaml = require("yaml");
const RLP = require('rlp');
const Web3 = require('web3');
const EthTx = require('@ethereumjs/tx');
const EthCom = require('@ethereumjs/common');
const EthUtil = require('ethereumjs-util');
const EthWallet = require('ethereumjs-wallet');

const deploymentManagerContract = require("../contract/DeploymentManager.json");

const optionDefinitions = [
  { 
    name: 'command',
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
    name: 'state',
    description: 'Path to state json file.',
    alias: 's',
    type: String,
    typeLabel: '{underline ./deployment-state.json}',
    defaultValue: './deployment-state.json'
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
];
const projectOptionDefinitions = [
  { 
    name: 'project',
    defaultOption: true,
  },
  {
    name: 'manager',
    description: 'Use DeploymentManager at this address',
    alias: 'm',
    type: String,
    typeLabel: '{underline 0x...}',
  },
];

const options = commandLineArgs(optionDefinitions, { stopAtFirstUnknown: true });

var web3 = null;
var web3Common = null;
var wallet = null;
var state = null;
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
  loadState();

  switch((options['command'] || "").toLowerCase()) {
    case "manager":
      await deployManager();
      break;
    case "project":
      await deployProject();
      break;
    default:
      printHelp();
      console.log("Unknown command: " + options['command']);
      console.log("");
      return;
  }
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

function loadState() {
  if(fs.existsSync(options['state'])) {
    state = JSON.parse(fs.readFileSync(options['state']));
  }
  else {
    resetState(0);
  }
}

function resetState(chainId) {
  state = {
    chainId: chainId,
    manager: null,
    deployed: {},
    exports: {}
  };
}

function saveState() {
  fs.writeFileSync(options['state'], JSON.stringify(state));
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

function buildEthTx(to, amount, nonce) {
  var rawTx = {
    nonce: nonce,
    gasLimit: options['gaslimit'],
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: to,
    value: "0x" + amount.toString(16)
  };
  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);

  var txRes = tx.serialize().toString('hex');
  return txRes;
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

async function deployManager() {
  await startWeb3();
  initWeb3Chain(wallet.chainid);
  if(state.chainId != wallet.chainid)
    resetState();

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: 2000000,
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: null,
    value: 0,
    data: Buffer.from(deploymentManagerContract.bytecode, "hex"),
  };
  var privateKey = Uint8Array.from(wallet.privkey);
  var tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: web3Common });
  tx = tx.sign(privateKey);
  var txhex = tx.serialize().toString('hex');

  var txres = await publishTransaction(txhex);
  wallet.nonce++;
  console.log("deploying DeplomentManager contract (tx: " + txres[0] + ")");

  await txres[1];

  var deployEnc = Buffer.from(RLP.encode([wallet.addr, nonce]));
  var deployHash = web3.utils.sha3(deployEnc);
  var deployAddr = web3.utils.toChecksumAddress("0x"+deployHash.substring(26));

  console.log("deployed DeplomentManager: " + deployAddr);

  state.manager = deployAddr;
  saveState();

  return deployAddr;
}

async function deployProject() {
  await startWeb3();
  initWeb3Chain(wallet.chainid);
  if(state.chainId != wallet.chainid)
    resetState();

  const projectOpts = commandLineArgs(projectOptionDefinitions, { argv: options._unknown || [], stopAtFirstUnknown: true });
  if(!projectOpts['project']) {
    console.log("missing project name.");
    return;
  }

  // get deployment manager
  if(projectOpts['manager'] && (!state.manager || projectOpts['manager'].toLowerCase() !== state.manager.toLowerCase())) {
    state.manager = projectOpts['manager'];
    saveState();
  }
  else if(!state.manager) {
    console.log("DeplomentManager not deployed yet.");
    return;
  }
  deploymentManager = new web3.eth.Contract(deploymentManagerContract.managerAbi, state.manager);
  
  // load project
  var projectPath = path.join(".", "projects", projectOpts['project']);
  if(!fs.existsSync(path.join(projectPath, "deployment.yaml"))) {
    console.log("could not find deployment.yaml in " + projectPath);
    return;
  }
  if(!fs.existsSync(path.join(projectPath, "signatures.yaml"))) {
    console.log("could not find signatures.yaml in " + projectPath);
    return;
  }
  var projectYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "deployment.yaml"), "utf-8"));
  var signaturesYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "signatures.yaml"), "utf-8"));
  var projectRefs = {};

  // check if already deployed
  var skipSteps = 0;
  var deployerAddr = await deploymentManager.methods["getDeployer"](projectYaml.account.address, projectYaml.account.salt).call();
  if(deployerAddr && !deployerAddr.match(/^0x0+$/)) {
    var deployerContract = new web3.eth.Contract(deploymentManagerContract.accountAbi, deployerAddr);
    var deployerCallNonce = await deployerContract.methods["callNonce"]().call();
    if(deployerCallNonce >= projectYaml.steps.length) {
      console.log("project " + projectOpts['project'] + " is already deployed!");
      return;
    }
    else if(deployerCallNonce > 0) {
      console.log("project " + projectOpts['project'] + " is deployed incompletely... Trying to continue with step " + deployerCallNonce);
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
    console.log("no deployment steps for " + projectOpts['project']);
    return;
  }
  if(!signaturesYaml.signatures || !Array.isArray(signaturesYaml.signatures) || signaturesYaml.signatures.length !== projectYaml.steps.length) {
    console.log("number of signatures does not match number of steps for " + projectOpts['project']);
    return;
  }

  var deploymentPromises = [];
  for(let i = skipSteps; i < projectYaml.steps.length; i++) {
    let step = projectYaml.steps[i];
    let res;
    switch(step.action) {
      case "create":
        res = await runDeploymentCreateStep(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
      case "create2":
        res = await runDeploymentCreate2Step(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
      case "call":
        res = await runDeploymentCallStep(projectYaml, i, step, signaturesYaml.signatures[i], projectRefs);
        break;
    }
    if(res) {
      console.log(" tx hash: " + res[0]);
      deploymentPromises.push(res[1]);
    }
  }

  console.log("deployment completed, awaiting confirmations...");
  await Promise.all(deploymentPromises);
  console.log("all transactions confirmed!");
}

async function checkProjectDependency(projectName, projectRefs) {
  var projectPath = path.join(".", "projects", projectName);
  if(!fs.existsSync(path.join(projectPath, "deployment.yaml"))) {
    console.log("dependency check for " + projectName + " failed: could not find deployment.yaml in " + projectPath);
    return false;
  }
  var projectYaml = yaml.parse(fs.readFileSync(path.join(projectPath, "deployment.yaml"), "utf-8"));
  if(!projectYaml.steps || !Array.isArray(projectYaml.steps) || projectYaml.steps.length == 0) {
    console.log("dependency check for " + projectName + " skipped: no deployment steps in project");
    return true;
  }

  // collect exports
  var exportKeys;
  if(projectRefs && projectYaml.exports && (exportKeys = Object.keys(projectYaml.exports)).length > 0) {
    for(let i = 0; i < exportKeys.length; i++) {
      let exportKey = exportKeys[i];
      let exportRef = projectYaml.exports[exportKey].split(":");
      switch(exportRef[0]) {
        case "create":
          projectRefs[projectName + "." + exportKey] = await deploymentManager.methods["getCreateAddress"](projectYaml.account.address, projectYaml.account.salt, parseInt(exportRef[1])).call();
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


async function runDeploymentCreateStep(projectYaml, idx, step, signature, projectRefs) {
  console.log("deployment step " + idx + ": create");

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
    gasLimit: step.gas || projectYaml.gas || 10000000,
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: state.manager,
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
  console.log("deployment step " + idx + ": create2");

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
    gasLimit: step.gas || projectYaml.gas || 10000000,
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: state.manager,
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

async function runDeploymentCallStep(projectYaml, idx, step, signature, projectRefs) {
  console.log("deployment step " + idx + ": call");

  var callData = deploymentManager.methods["callFor"](
    // callFor(address account, uint account_salt, address addr, uint256 amount, bytes memory data, uint128 callNonce, bytes memory signature)
    projectYaml.account.address,
    projectYaml.account.salt,
    step.address,
    "0x" + (step.amount || 0).toString(16),
    Buffer.from(step.data.replace(/^0x/, ""), "hex"),
    idx,
    Buffer.from(signature.replace(/^0x/, ""), "hex")
  ).encodeABI();

  var nonce = wallet.nonce;
  var rawTx = {
    nonce: nonce,
    gasLimit: step.gas || projectYaml.gas || 10000000,
    maxPriorityFeePerGas: options['maxpriofee'] * 1000000000,
    maxFeePerGas: options['maxfeepergas'] * 1000000000,
    from: wallet.addr,
    to: state.manager,
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