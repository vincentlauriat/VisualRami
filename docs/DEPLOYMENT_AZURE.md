# Deploying VisualRami on Azure App Service

Validated on 2026-09-15 on a Basic B1 Linux plan in West Europe. The procedure below is generic.

## Requirements

- Linux App Service plan, **Basic B1 or above**. The free F1 tier caps WebSockets at 5 per instance
  and has no Always On, which is too tight for a 4-player table with reconnections.
- Runtime `NODE:24-lts` (check with `az webapp list-runtimes --os-type linux`).
- **WebSockets enabled** on the Web App, otherwise Socket.IO silently falls back to long polling.
- **One instance.** No sticky sessions or Socket.IO adapter are configured.

## Why a local package

Two things rule out the remote Oryx build:

1. npm workspaces install `@visualrami/shared` as a symlink; symlinks do not survive a zip.
2. The remote build on a B1 plan exceeds Kudu's timeout (`HTTP_504`, seen on another project).

`Scripts/build-azure.sh` therefore builds locally and assembles a flat tree that mirrors the repo:

```
package.json            start script + runtime deps (express, socket.io) pinned from the lockfile
node_modules/           npm install --omit=dev, then a real copy of @visualrami/shared
server/package.json     keeps "type": "module"
server/dist/            compiled server
client/dist/            built client, served by the server at ../../client/dist
```

The script boots the package on a local port, checks `/healthz` and the home page, then zips it
to `release/visualrami-azure.zip`.

## Procedure

```bash
# 1. package
Scripts/build-azure.sh

# 2. web app (once)
RG=<resource-group> PLAN=<plan> APP=visualrami-<suffix>
az webapp create -g $RG -p $PLAN -n $APP --runtime "NODE:24-lts"
az webapp config set -g $RG -n $APP --web-sockets-enabled true --startup-file "node server/dist/index.js"
az webapp config appsettings set -g $RG -n $APP --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false WEBSITES_CONTAINER_START_TIME_LIMIT=300
az webapp log config -g $RG -n $APP --docker-container-logging filesystem

# 3. deploy
az webapp deploy -g $RG -n $APP --src-path release/visualrami-azure.zip --type zip --async true

# 4. verify (do not trust the CLI, see pitfalls)
az webapp log deployment list -g $RG -n $APP --query "[0].{status:status, end:end_time}"
curl https://$APP.azurewebsites.net/healthz
node Scripts/probe-remote.mjs https://$APP.azurewebsites.net
```

Optional app settings: `CORS_ORIGIN` (only if the client is served from another origin),
build-time `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` for a TURN relay.

## Pitfalls met

| Symptom | Cause | Fix |
|---|---|---|
| Container exits with `ERR_MODULE_NOT_FOUND: @visualrami/shared` | `npm install` in the package dir pruned the undeclared workspace package | copy `shared` **after** `npm install` (done in the script) |
| `az webapp deploy` never returns, even with `--async true` | CLI polling issue; Kudu marks the deployment successful in ~15 s | check `az webapp log deployment list`, kill the CLI |
| `/healthz` 200 right after deploy, then old behaviour | the previous container answers until the recycle (~40 s) | wait for the new deployment's `end_time`, then probe |
| 503 with "site is being blocked" | repeated cold-start failures | read `LogFiles/StartupLogs/*_failure.log` after `az webapp log download` |
| Quota `Current Limit (B1 VMs): 0` | regional App Service quota | deploy the plan in another region (the RG can be elsewhere) |
