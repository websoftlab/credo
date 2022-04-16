# CredoJS Project

**Attention!** The project is under development, a full description will be later. The project is in the beta testing stage.

> A small wrapper (framework) for the KOA server, and the subsequent building of the application 
> using Webpack (client side and server side render) and Rollup (server side).

## Start project

For install project

```shell
yarn add credo
yarn credo install [--render react] [--from <template_directory>]
```

## Project commands

```shell
# credo commands
yarn credo install                   # install system
yarn credo install plugin-name       # install additional plugin
yarn credo dev                       # start dev server
yarn credo make                      # make build files to ./credo directory
yarn credo build                     # create build

# credo-serv (production only, after credo build)
yarn credo-serv start                # start server
yarn credo-serv start --background   # start server in background
yarn credo-serv stop                 # stop server
yarn credo-serv status               # server status (online or offline)
yarn credo-serv stat                 # server CPU statistic
yarn credo-serv cmd [...options]     # running an internal command

# for more information use --help [?command-name]
```

## Terms and concepts of the CredoJS application

### Global var `credo`

> todo

### Application mode

| Mode   | How to discover | Comment |
|---     |---              |---      |
| `app`  | `credo.isApp() === true`  | Started HTTP Server (koa) |
| `cron` | `credo.isCron() === true` | Started CRON Server (node-schedule) |
| `cmd`  | `credo.isCmd() === true`  | Started internal terminal command |

### Service

> todo

### Controller

> todo

### Responder

> todo

### Route

> todo

### Middleware

> todo

### Extra middleware

> todo

### Hooks

> todo

### Bootstrap & Bootloader

> todo

### CredoJS packages

| Package | Comment |
|---      |---      |
| [credo](./packages/credo) | Development: installation, building, watching. |
| [create-credo-app](./packages/create-credo-app) | - |
| [@credo-js/server](./packages/server) | Main HTTP server (wrapper for `koa`). |
| [@credo-js/responder-static](./packages/responder-static) | Static files responder. `koa-static` alternative. |
| [@credo-js/responder-text](./packages/responder-text) | Text responder. |
| [@credo-js/responder-json](./packages/responder-json) | JSON responder (work with cors). |
| [@credo-js/responder-page](./packages/responder-page) | HTML page responder. |
| [@credo-js/render-driver-react](./packages/render-driver-react) | Page rendering driver for `react`. |
| [@credo-js/app](./packages/app) | Application tools (using `mobx` observation). |
| [@credo-js/lexicon](./packages/lexicon) | Library for working with language packs and files. |
| [@credo-js/path-to-pattern](./packages/path-to-pattern) | Route Path Parser. |
| [@credo-js/make-url](./packages/make-url) | URL builder. |
| [@credo-js/loadable](./packages/loadable) | Dynamic import for client side and server side rendering. |
| [@credo-js/html-head](./packages/html-head) | HTML tools. Working with document HEAD tags. |
| [@credo-js/utils](./packages/utils) | Utilities. |
| [@credo-js/cli-cmp](./packages/cli-cmp) | Runtime tools, JS file generator. |
| [@credo-js/cli-color](./packages/cli-color) | - |
| [@credo-js/cli-commander](./packages/cli-commander) | - |
| [@credo-js/cli-debug](./packages/cli-debug) | Logging. Wrapper for `debug` or `winston` packages. |
| [@credo-js/types](./packages/types) | Global types of typescript. |
| [@credo-js/extra](./packages/extra) | Extra application tools. |

> todo

### Project structure

| Path | Watch | Configurable | Production | Comment |
|---   |---    |---           |---         |---      |
| **Build directories** | | | | |
| `/.credo`             | | | | Global building files, compiled by the system. |
| `/dev`                | | | | Development `Webpack` and `Rollup` files. |
| `/build`              | | | `only` | Production build. |
| **Directories**       | | | | |
| `/src-client`         | `client` | | | Render template files used only on the client side when `SSR` is disabled. |
| `/src-server`         | `server` | | | Server side files only. For `nodejs` v14 and up. |
| `/src-full`           | `client` & `server` | | | Files that are used both on the client side and on the server side. Should not contain nodejs global library imports. Not recommended for use. It's better to use package.json dependencies. |
| `/lexicon`            | `global` | | | Languages files. Those files are included into build. |
| `/config`             | `global` | | `yes` | Configuration files. You can change the configuration after a production build. |
| **Files**             | | | | |
| `/.env`               | `global` | | `yes` | Environment vars. Used if `/.production.env` or `/.development.env` does not exist. |
| `/.production.env`    | | | `yes` | Environment vars. For `production` mode. |
| `/.development.env`   | `global` | | | Environment vars. For `development` mode. |
| `/credo.json`         | `global` | | | Global configurations and parameters of the CredoJS application. |
| `/credo.json.install` | | | | Generated dynamic. Information about installed plugins. |
| `/credo-pid.json`     | | `yes` | `only` | Generated dynamic. Information about PID and processor. |
| `/credo-watch.log`    | | | | Full watch dev server log file. |
| `/credo-env.d.ts`     | | | | Global typescript types. Additional file types are recommended to be moved to the `./types` directory. |
| `/tsconfig.json`      | `global` | | | Typescript config file. You can also use `./tsconfig-server.json` and `./tsconfig-client.json` files. |
| `/package.json`       | `global` | | `yes` | NPM package configuration. A WARNING! The `project name` option is required! |

### `* global` watching. 

> If changes are made to the global watch field, the watcher regenerates 
> the `./credo` building files and restarts other watchers.