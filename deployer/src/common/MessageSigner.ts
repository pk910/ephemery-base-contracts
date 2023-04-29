import * as ethers from "ethers"
import * as EthUtil from "ethereumjs-util";

export class MessageSigner {
  private walletPrivKey: Buffer;
  private walletAddr: string;

  public constructor(privkey: Buffer) {
    this.walletPrivKey = privkey;
    this.walletAddr = EthUtil.toChecksumAddress("0x"+EthUtil.privateToAddress(privkey).toString("hex"));;
  }

  public getWalletAddress(): string {
    return this.walletAddr;
  }

  public generateSignature(stepHash: string): string {
    let ethMsg = ethers.solidityPacked([
      "string",
      "bytes32"
    ], [
      "\x19Ethereum Signed Message:\n32",
      stepHash
    ]);
    let ethMsgHash = ethers.keccak256(ethMsg);
    let privKey = new ethers.SigningKey("0x" + this.walletPrivKey.toString("hex"));
    let stepSig = privKey.sign(ethMsgHash);
    return stepSig.serialized;
  }

}
