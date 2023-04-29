import { parseCliArgs } from "./args";
import { runDeployCommand } from "./command/deploy";
import { runSignCommand } from "./command/sign";

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
  }

})();