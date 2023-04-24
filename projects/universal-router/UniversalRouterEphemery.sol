// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

import {UniversalRouter} from './UniversalRouter.sol';
import {RouterParameters} from './base/RouterImmutables.sol';

contract UniversalRouterEphemery {
    address public universalRouter;

    constructor() {
        address unsupportedProtocol = address(0xC372a6223F4e98e6Fa97e0bA79074A1CD774b3Ac);
        RouterParameters memory params = RouterParameters({
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            weth9: 0x2cE89A6c99B45d1b62c1c07cAF731bF12d88C293,
            seaport: 0x00000000006c3852cbEf3e08E8dF289169EdE581,
            nftxZap: unsupportedProtocol,
            x2y2: unsupportedProtocol,
            foundation: unsupportedProtocol,
            sudoswap: unsupportedProtocol,
            nft20Zap: unsupportedProtocol,
            cryptopunks: unsupportedProtocol,
            looksRare: unsupportedProtocol,
            routerRewardsDistributor: unsupportedProtocol,
            looksRareRewardsDistributor: unsupportedProtocol,
            looksRareToken: unsupportedProtocol,
            v2Factory: 0xE8d5636117Ad5786dB1A7c84480F988F1a447c3c,
            v3Factory: 0x15D38a36319c0525276E5D69BeFfA7aB4f55845A,
            pairInitCodeHash: 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f,
            poolInitCodeHash: 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54
        });
        universalRouter = address(new UniversalRouter(params));
    }
}
