
import commandLineArgs from "command-line-args"
import * as commandLineUsage from "command-line-usage"

export interface CliArgs {
  verbose: boolean;
  rpchost: string;
  privkey?: string;
  maxfeepergas?: number;
  maxpriofee?: number;
  maxgaslimit?: number;

  command: string;
  commandArgs: any;
}

const globalOptionsDefinition: commandLineUsage.OptionDefinition[] = [
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean,
    defaultValue: false
  },
  {
    name: 'verbose',
    description: 'Run with verbose output.',
    alias: 'v',
    type: Boolean,
  },
  {
    name: 'rpchost',
    description: 'Ethereum execution layer RPC host.',
    alias: 'r',
    type: String,
    typeLabel: '{underline http://127.0.0.1:8545}',
    defaultValue: 'http://127.0.0.1:8545'
  },
  {
    name: 'privkey',
    description: 'The private key of the deployer wallet.\n(Special: "env" to read from DEPLOYER_PRIVKEY environment variable)',
    alias: 'p',
    type: String,
    typeLabel: '{underline privkey}',
  },
  {
    name: 'maxfeepergas',
    description: 'The maximum fee per gas in gwei.',
    type: Number,
    typeLabel: '{underline 20}',
    defaultValue: 20,
  },
  {
    name: 'maxpriofee',
    description: 'The maximum priority fee per gas in gwei.',
    type: Number,
    typeLabel: '{underline 1.2}',
    defaultValue: 1.2,
  },
  {
    name: 'maxgaslimit',
    description: 'The maximum gaslimit per transaction.',
    type: Number,
    typeLabel: '{underline 10000000}',
    defaultValue: 10000000,
  },
  {
    name: 'command',
    type: String,
    typeLabel: '{underline command}',
    defaultOption: true
  },
];

const cliCommandDefinition: {
  [command: string]: {
    description: string;
    args: commandLineUsage.OptionDefinition[];
  }
} = {
  "deploy": {
    description: "",
    args: [
      {
        name: 'verify-sources',
        description: 'Verify contract sources with block explorers.',
        type: Boolean,
      },
    ]
  }
};


export function parseCliArgs(argv: string[]): CliArgs {
  let globalOptions = commandLineArgs(globalOptionsDefinition, {
    argv: argv,
    stopAtFirstUnknown: true,
  });
  
  if(globalOptions['help']) {
    printCliUsage();
    return null;
  }

  if(!globalOptions['command']) {
    printCliUsage();
    console.log("");
    console.log("No command specified.");
    return null;
  }

  let commandDefinition = cliCommandDefinition[globalOptions['command']];
  if(!commandDefinition) {
    printCliUsage();
    console.log("");
    console.log("Unknown command '" + globalOptions['command'] + "'.");
    return null;
  }

  let commandArgs = commandLineArgs(commandDefinition.args, {
    argv: globalOptions._unknown || [],
  });

  delete globalOptions._unknown;
  let cliArgs: CliArgs = globalOptions as CliArgs;
  cliArgs.commandArgs = commandArgs;
  return cliArgs;
}

export function printCliUsage(command?: string) {
  console.log(commandLineUsage.default([
    {
      header: 'Contract Deployment Tool',
      content: 'A tool that can be used to deploy pre-defined contracts.'
    },
    {
      header: 'Options',
      optionList: globalOptionsDefinition
    }
  ]));
}