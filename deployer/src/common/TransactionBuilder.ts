import { Logger } from "./Logger";
import { TTransactionPromise, Web3Manager } from "./Web3Manager";
import * as EthTx from "@ethereumjs/tx";
import * as EthCom from "@ethereumjs/common";
import * as EthUtil from "ethereumjs-util";
import { TransactionReceipt } from "web3-core"
import { weiToEth } from "../utils/EthUnits";

export interface ITransactionBuilderOptions {
  web3Manager: Web3Manager;
  privkey: Buffer;
  maxpriofee: number;
  maxfeepergas: number;
  maxgaslimit: number;
}

interface WalletState {
  address: string;
  balance: bigint;
  nonce: number;
}

export class TransactionBuilder {
  private options: ITransactionBuilderOptions;
  private wallet: WalletState;
  private web3Common: EthCom.Common;
  private readyPromise: Promise<void>;

  public constructor(options: ITransactionBuilderOptions) {
    this.options = options;
    this.readyPromise = this.initWallet();
  }

  private initWallet(): Promise<void> {
    let walletAddr = EthUtil.toChecksumAddress("0x"+EthUtil.privateToAddress(this.options.privkey).toString("hex"));

    return Promise.all([
      this.options.web3Manager.getChainId(),
      this.options.web3Manager.getBalance(walletAddr),
      this.options.web3Manager.getTransactionCount(walletAddr),
    ]).then((res) => {
      this.web3Common = EthCom.Common.custom({
        chainId: res[0],
        defaultHardfork: EthCom.Hardfork.London,
      });
      this.wallet = {
        address: walletAddr,
        balance: res[1],
        nonce: res[2],
      };
      Logger.info("TransactionBuilder.initWallet", "wallet " + this.wallet.address + " balance: " + weiToEth(this.wallet.balance) + " ETH [nonce: " + this.wallet.nonce + "]");
    });
  }

  public async getWalletAddress(): Promise<string> {
    await this.readyPromise;
    return this.wallet.address;
  }

  public async generateTransaction(to: string, amount: string, data: string, gaslimit?: number): Promise<TTransactionPromise> {
    await this.readyPromise;

    let rawTx = {
      nonce: this.wallet.nonce,
      gasLimit: gaslimit || this.options.maxgaslimit || 10000000,
      maxPriorityFeePerGas: this.options.maxpriofee * 1000000000,
      maxFeePerGas: this.options.maxfeepergas * 1000000000,
      from: this.wallet.address,
      to: "0x" + to.replace(/^0x/, ""),
      value: "0x" + BigInt(amount).toString(16),
      data: data ? Buffer.from(data.replace(/^0x/, ""), "hex") : "0x"
    };

    let tx = EthTx.FeeMarketEIP1559Transaction.fromTxData(rawTx, { common: this.web3Common });
    tx = tx.sign(this.options.privkey);

    let txhex = tx.serialize().toString('hex');
    let txres = await this.options.web3Manager.publishTransaction(txhex);
    this.wallet.nonce++;

    return txres;
  }

}
