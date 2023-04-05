# Ephemery dApp primitives

## Prepare
```
git clone https://github.com/pk910/ephemery-base-contracts.git
cd ephemery-base-contracts
npm i
```

## Run deployment
```
npm run deploy -- -p "<your wallet privkey>" -r <eth-rpc-url> <project-name>
```

For example:
```
export privkey="<eth wallet privkey>"
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 _manager
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 0xsplits-wallet
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 multisender
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 gnosis-safe
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 permit2
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 weth9
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 seaport
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 uniswap-v2
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 uniswap-v3
npm run deploy -- -p $privkey -r http://127.0.0.1:8545 sushiswap
```

There is currently no automatic dependency resolution. 
If you see an error complaining about failed depencency check, deploy the dependency project first and try again.

## Projects

See list of projects in the [projects](https://github.com/pk910/ephemery-base-contracts/tree/master/projects) directoy.