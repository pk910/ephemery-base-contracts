# Multisender

Mode: `managed`

Owner: `0x49e0fd3800C117357057534E30c5B5115C673488` / 7  (pk910)

## Contracts 

| Contract | Address | Source |
| -------- | ------- | ------ |
| EternalStorageProxyForStormMultisender  | `0x6d713e16322D857eF15803eEb03e1b56e9a3fa97`  | [EternalStorageProxyForStormMultisender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/EternalStorageProxyForStormMultisender.sol) / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/EternalStorageProxyForStormMultisender_flat.sol) |
| UpgradebleStormSender  | `0x2b531cF73EFA053E6c097eF0407267f6325210b2`  | [UpgradebleStormSender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/multisender/UpgradebleStormSender.sol)  / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/UpgradebleStormSender_flat.sol) |

## Customization

Added custom initialize contract to avoid ownership takeover during deployment.
