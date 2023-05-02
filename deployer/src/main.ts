import { parseCliArgs } from "./args";
import { runDeployCommand } from "./command/deploy";
import { runSignCommand } from "./command/sign";
import { runVerifyCodesCommand } from "./command/verify-codes";

(async () => {
  // parse command line args
  let deployerArgs = parseCliArgs(process.argv);
  if(!deployerArgs)
    return;

  switch(deployerArgs.command) {
    case "deploy":
      await runDeployCommand(deployerArgs);
      break;
    case "sign":
      await runSignCommand(deployerArgs);
      break;
    case "verify-codes":
      await runVerifyCodesCommand(deployerArgs);
      break;
  }

})();