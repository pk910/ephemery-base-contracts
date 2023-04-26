
import ethers from "ethers"

export function calculateCreateAddr(addr: string, nonce: number): string {
  let data: string;
  if (nonce == 0x00) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1"], 
      ["0xd6", "0x94", addr, "0x80"]
    );
  else if (nonce <= 0x7f) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1"], 
      ["0xd6", "0x94", addr, "0x"+nonce.toString(16).padStart(2, "0")]
    );
  else if (nonce <= 0xff) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint8"], 
      ["0xd7", "0x94", addr, "0x81", "0x"+nonce.toString(16).padStart(2, "0")]
    );
  else if (nonce <= 0xffff) 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint16"], 
      ["0xd8", "0x94", addr, "0x82", "0x"+nonce.toString(16).padStart(4, "0")]
    );
  else if (nonce <= 0xffffff)
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint24"], 
      ["0xd9", "0x94", addr, "0x83", "0x"+nonce.toString(16).padStart(6, "0")]
    );
  else 
    data = ethers.solidityPacked(
      ["bytes1", "bytes1", "address", "bytes1", "uint32"], 
      ["0xda", "0x94", addr, "0x84", "0x"+nonce.toString(16).padStart(8, "0")]
    );
  
  let dataHash = ethers.keccak256(data);
  let createAddr = "0x" + dataHash.substring(dataHash.length - 40);
  return ethers.getAddress(createAddr);
}

export function calculateCreate2Addr(addr: string, salt: string, bytecode: string): string {
  if(!bytecode.match(/^0x/))
    bytecode = "0x" + bytecode;
  var dataHash = ethers.keccak256(ethers.solidityPacked(
    ["bytes1", "address", "uint", "bytes32"],
    ["0xff", addr, salt, ethers.keccak256(bytecode)]
  ));
  var createAddr = "0x" + dataHash.substring(dataHash.length - 40);
  return ethers.getAddress(createAddr);
}
