# Multisender

Mode: `managed`

Owner: `0x49e0fd3800C117357057534E30c5B5115C673488` / 7  (pk910)

## Contracts 

| Contract | Address | Source |
| -------- | ------- | ------ |
| EternalStorageProxyForStormMultisender  | `0xaB6A3A55286c61969b7137080aA14c8B1a31E06d`  | [EternalStorageProxyForStormMultisender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/EternalStorageProxyForStormMultisender.sol) / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/EternalStorageProxyForStormMultisender_flat.sol) |
| UpgradebleStormSender  | `0xCC799D8b255CB9CEfa38475aaD188d18d7B68981`  | [UpgradebleStormSender.sol](https://github.com/rstormsf/multisender/blob/master/contracts/contracts/multisender/UpgradebleStormSender.sol)  / [flat](https://github.com/rstormsf/multisender/blob/master/contracts/flats/UpgradebleStormSender_flat.sol) |

## Customization

Added custom initialize contract to avoid ownership takeover during deployment.
