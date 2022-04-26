# PhragonJS Project

**Attention!** The project is under development, a full description will be later. The project is in the beta testing stage.

> A small wrapper (framework) for the KOA server, and the subsequent building of the application 
> using Webpack (client side and server side render) and Rollup (server side).

## Start project

For install project

```shell
yarn add phragon
yarn phragon install
```

## Project commands

```shell
# phragon commands
yarn phragon install                   # install system
yarn phragon install plugin-name       # install additional plugin
yarn phragon dev                       # start dev server
yarn phragon make                      # make build files to ./phragon directory
yarn phragon build                     # create build

# phragon-serv (production only, after phragon build)
yarn phragon-serv start                # start server
yarn phragon-serv start --background   # start server in background
yarn phragon-serv stop                 # stop server
yarn phragon-serv status               # server status (online or offline)
yarn phragon-serv stat                 # server CPU statistic
yarn phragon-serv cmd [...options]     # running an internal command

# for more information use --help [?command-name]
```

## Terms and concepts of the PhragonJS application

### Global var `phragon`

> todo

### Application mode

| Mode   | How to discover | Comment |
|---     |---              |---      |
| `app`  | `phragon.isApp() === true`  | Started HTTP Server (koa) |
| `cron` | `phragon.isCron() === true` | Started CRON Server (node-schedule) |
| `cmd`  | `phragon.isCmd() === true`  | Started internal terminal command |

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

### PhragonJS packages

| Package | Comment |
|---      |---      |
| [phragon](./packages/phragon) | Development: installation, building, watching. |
| [create-phragon-app](./packages/create-phragon-app) | - |
| [@phragon/server](./packages/server) | Main HTTP server (wrapper for `koa`). |
| [@phragon/responder-static](./packages/responder-static) | Static files responder. `koa-static` alternative. |
| [@phragon/responder-text](./packages/responder-text) | Text responder. |
| [@phragon/responder-json](./packages/responder-json) | JSON responder (work with cors). |
| [@phragon/responder-page](./packages/responder-page) | HTML page responder. |
| [@phragon/render-driver-react](./packages/render-driver-react) | Page rendering driver for `react`. |
| [@phragon/app](./packages/app) | Application tools (using `mobx` observation). |
| [@phragon/lexicon](./packages/lexicon) | Library for working with language packs and files. |
| [@phragon/path-to-pattern](./packages/path-to-pattern) | Route Path Parser. |
| [@phragon/make-url](./packages/make-url) | URL builder. |
| [@phragon/loadable](./packages/loadable) | Dynamic import for client side and server side rendering. |
| [@phragon/html-head](./packages/html-head) | HTML tools. Working with document HEAD tags. |
| [@phragon/utils](./packages/utils) | Utilities. |
| [@phragon/cli-cmp](./packages/cli-cmp) | Runtime tools, JS file generator. |
| [@phragon/cli-color](./packages/cli-color) | - |
| [@phragon/cli-commander](./packages/cli-commander) | - |
| [@phragon/cli-debug](./packages/cli-debug) | Logging. Wrapper for `debug` or `winston` packages. |
| [@phragon/types](./packages/types) | Global types of typescript. |
| [@phragon/extra](./packages/extra) | Extra application tools. |

> todo

### Project structure

| Path | Watch | Configurable | Production | Comment |
|---   |---    |---           |---         |---      |
| **Build directories**   | | | | |
| `/.phragon`             | | | | Global building files, compiled by the system. |
| `/dev`                  | | | | Development `Webpack` and `Rollup` files. |
| `/build`                | | | `only` | Production build. |
| **Directories**         | | | | |
| `/src-client`           | `client` | | | Render template files used only on the client side when `SSR` is disabled. |
| `/src-server`           | `server` | | | Server side files only. For `nodejs` v14 and up. |
| `/src-full`             | `client` & `server` | | | Files that are used both on the client side and on the server side. Should not contain nodejs global library imports. Not recommended for use. It's better to use package.json dependencies. |
| `/lexicon`              | `global` | | | Languages files. Those files are included into build. |
| `/config`               | `global` | | `yes` | Configuration files. You can change the configuration after a production build. |
| **Files**               | | | | |
| `/.env`                 | `global` | | `yes` | Environment vars. Used if `/.production.env` or `/.development.env` does not exist. |
| `/.production.env`      | | | `yes` | Environment vars. For `production` mode. |
| `/.development.env`     | `global` | | | Environment vars. For `development` mode. |
| `/phragon.json`         | `global` | | | Global configurations and parameters of the PhragonJS application. |
| `/phragon.json.install` | | | | Generated dynamic. Information about installed plugins. |
| `/phragon-pid.json`     | | `yes` | `only` | Generated dynamic. Information about PID and processor. |
| `/phragon-watch.log`    | | | | Full watch dev server log file. |
| `/phragon-env.d.ts`     | | | | Global typescript types. Additional file types are recommended to be moved to the `./types` directory. |
| `/tsconfig.json`        | `global` | | | Typescript config file. You can also use `./tsconfig-server.json` and `./tsconfig-client.json` files. |
| `/package.json`         | `global` | | `yes` | NPM package configuration. A WARNING! The `project name` option is required! |

### `* global` watching. 

> If changes are made to the global watch field, the watcher regenerates 
> the `./phragon` building files and restarts other watchers.