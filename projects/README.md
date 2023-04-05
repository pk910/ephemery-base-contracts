# Projects

In this directory you can find all projects that can be deployed.

Each project consists of a `deployment.yaml` that holds all neccesary steps to deploy the project contracts.

There are currently two supported deployment modes: `standalone` and `managed`.

## `standalone`/`unmanaged` project

`standalone` projects are deployed directly from the supplied key.

Supported deployment actions in `standalone` projects:
* `publish`: publish a pre-signed transaction
* `call`: call a contract or send funds

Be aware that all steps are executed from an "untrusted sender" in this deployment mode.

## `managed` project

`managed` projects are not deployed directly from the supplied private key. 

Instead, the DeploymentManager contract is used to execute the deployment steps from an abstracted deployment account.
All deployment steps are executed on behalf of the account specified in the `account:` section.
With this deployment account abstraction, even complex deployment procedures that assign special privileges to the deployment account can be run securely in a trust-less & key-less way.

The consistency and execution order of all managed deployment steps is ensured via signatures.
After modifying/creating a managed project, the project signatures need to be recreated via `npm run sign <project-name>`.
That tool will ask for the private-key of the project owner and generate a `signatures.yaml` with signatures for all deployment steps. 

All `managed` projects have an implicit dependency to the `_manager` project.

Supported deployment actions in `managed` projects:
* `create`: create contract via `CREATE` call
* `create2`: create contract via `CREATE2` call
* `call`: call a contract or send funds

