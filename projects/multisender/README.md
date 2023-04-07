# Multisender

Mode: `managed`

Owner: `0x49e0fd3800C117357057534E30c5B5115C673488` / 7  (pk910)

## Contracts 

| Contract | Address | Source |
| -------- | ------- | ------ |
| EternalStorageProxyForStormMultisender  | `0x884F21ceA6ef235360DdfcC50623D1092E1d8224`  | [EternalStorageProxyForStormMultisender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/EternalStorageProxyForStormMultisender.sol) / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/EternalStorageProxyForStormMultisender_flat.sol) |
| UpgradebleStormSender  | `0xCE9358E8eE25984f6EEE4C69d49A11E115F92FEF`  | [UpgradebleStormSender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/multisender/UpgradebleStormSender.sol)  / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/UpgradebleStormSender_flat.sol) |

## Customization

Added custom initialize contract to avoid ownership takeover during deployment.
