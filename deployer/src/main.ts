import { parseCliArgs } from "./args";
import { runDeployCommand } from "./command/deploy/command";

(async () => {
  // parse command line args
  let deployerArgs = parseCliArgs(process.argv);
  if(!deployerArgs)
    return;

  switch(deployerArgs.command) {
    case "deploy":
      await runDeployCommand(deployerArgs);
      break;
  }

})();