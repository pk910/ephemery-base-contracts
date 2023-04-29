import Web3 from "web3"
import { TransactionReceipt } from "web3-core"
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { weiToEth } from "../utils/EthUnits";
import { PromiseDfd } from "../utils/PromiseDfd";
import { Logger } from "./Logger";

export type TTransactionPromise = [txhash: string, receipt: Promise<TransactionReceipt>];

export class Web3Manager {
  public static instance: Web3Manager;

  private rpchost: string;
  private ready: boolean;
  private readyPromise: Promise<void>;
  private web3: Web3;
  private chainId: number;


  public constructor(rpchost: string) {
    this.rpchost = rpchost;

    this.initWeb3();
    Web3Manager.instance = this;
  }
 
  private initWeb3() {
    try {
      Logger.debug("Web3Manager.initWeb3", "connecting to web3 rpc: " + this.rpchost);
      var web3Provider = new Web3.providers.HttpProvider(this.rpchost);
      this.web3 = new Web3(web3Provider);
      
      let initPromises: Promise<void>[] = [
        this.web3.eth.getChainId().then((chainId) => { this.chainId = chainId; })
      ];
      this.readyPromise = Promise.all(initPromises).then();
      
    } catch(ex) {
      Logger.error("Web3Manager.initWeb3", "web3 initialization error: ", ex);
    }
  }
  
  public async isContract(addr: string): Promise<boolean> {
    await this.readyPromise;
    let code = await this.web3.eth.getCode(addr);
    return code && !!code.match(/^0x[0-9a-f]{2,}$/);
  }
  
  public async getBalance(addr: string): Promise<bigint> {
    await this.readyPromise;
    let balance = await this.web3.eth.getBalance(addr);
    return BigInt(balance);
  }

  public async getTransactionCount(addr: string): Promise<number> {
    await this.readyPromise;
    let txcount = await this.web3.eth.getTransactionCount(addr);
    return txcount;
  }

  public async getChainId(): Promise<number> {
    await this.readyPromise;
    return this.chainId;
  }

  public async publishTransaction(txhex: string): Promise<TTransactionPromise> {
    let txhashDfd = new PromiseDfd<string>();
    let receiptDfd = new PromiseDfd<TransactionReceipt>();
    let txStatus = 0;
  
    let txPromise = this.web3.eth.sendSignedTransaction("0x" + txhex);
    txPromise.once('transactionHash', (hash) => {
      txStatus = 1;
      txhashDfd.resolve(hash);
    });
    txPromise.once('receipt', (receipt) => {
      txStatus = 2;
      receiptDfd.resolve(receipt);
    });
    txPromise.on('error', (error) => {
      if(txStatus === 0)
        txhashDfd.reject(error);
      else
        receiptDfd.reject(error);
    });
  
    let txHash = await txhashDfd.promise;
    return [txHash, receiptDfd.promise];
  }

  public getContractInterface(abi: AbiItem[], addr?: string): Contract {
    return new this.web3.eth.Contract(abi, addr);
  }

}
