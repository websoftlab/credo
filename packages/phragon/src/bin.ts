#!/usr/bin/env node

import { createCommander } from "@phragon/cli-commander";
import { join } from "path";
import build from "./build";
import watch from "./watch";
import { installPhragonJS, installPlugin } from "./plugins/installer";
import { debugBuild, debugWatch } from "./debug";
import type { Watch } from "./types";
import compiler from "./compiler";

const pg = require(join(__dirname, "package.json"));
const cmd = createCommander({
	prompt: "phragon",
	version: pg.version,
	description: `${pg.name} ${pg.description || ""}`,
});

cmd("make")
	.description("Compiles the project files")
	.action(async () => {
		debugBuild(`Trying to make ./phragon compiled files...`);
		await compiler();
		debugBuild(`Compilation completed`);
		return 0;
	});

cmd("dev")
	.description("Start development mode")
	.option("--host", { alt: "-H", type: "value", description: "Server hostname" })
	.option("--port", { alt: "-P", type: "value", description: "Server port", format: "port", name: "number" })
	.option("--dev-host", { type: "value", description: "Dev Server hostname" })
	.option("--dev-port", { type: "value", description: "Dev Server port", format: "port", name: "number" })
	.option("--cluster", { type: "value", description: "Cluster ID" })
	.option("--ssr", "Enable SSR")
	.option("--no-board", "Disable terminal board")
	.action<never, Watch.CMDOptions>(async (_, options) => {
		debugWatch(`Start {cyan development} mode`, options);
		await watch(options);
		return -1;
	});

cmd("build")
	.description("Make build")
	.option("--dev", "Build development mode")
	.action<never, { dev: boolean }>(async (_, options) => {
		const mode = options.dev ? "development" : "production";
		debugBuild(`Make {cyan ${mode}} build`);
		await build(mode);
		return 0;
	});

cmd("install")
	.description("Install plugin")
	.argument({
		name: "plugin-name",
		description: "Package plugin name or relative directory local path",
	})
	.action<string | null>(async (name) => {
		if (name) {
			await installPlugin(name);
		} else {
			await installPhragonJS();
		}
		return 0;
	});

cmd.begin()
	.then((code) => {
		if (code !== -1) {
			process.exit(code);
		}
	})
	.catch((err) => {
		throw err;
	});
