
export function weiToEth(wei: number|bigint): number {
  if(typeof wei === "number")
    return wei / 1000000000000000000;
  else
    return parseInt(wei.toString()) / 1000000000000000000;
}

