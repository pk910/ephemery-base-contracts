# Ephemery dApp primitives

## Prepare
```
git clone https://github.com/pk910/ephemery-base-contracts.git
cd ephemery-base-contracts
```

You can download pre-built binaries from the [leatest relase](https://github.com/pk910/ephemery-base-contracts/releases) (download to `bin` folder)

Or build them yourself (nodejs >18 required):
```
cd deployer
npm install
npm run release
```


## Run deployment
```
# run from root directory
bin/deployer -p "<your wallet privkey>" -r <eth-rpc-url> deploy <project-name>
```

For example:
```
export privkey="<eth wallet privkey>"
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy _manager
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy 0xsplits-wallet
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy multisender
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy gnosis-safe
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy permit2
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy weth9
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy seaport
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy uniswap-v2
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy uniswap-v3
bin/deployer -p $privkey -r http://127.0.0.1:8545 deploy sushiswap
```

There is currently no automatic dependency resolution. 
If you see an error complaining about failed depencency check, deploy the dependency project first and try again.

## Projects

See list of projects in the [projects](https://github.com/pk910/ephemery-base-contracts/tree/master/projects) directoy.
