#!/usr/bin/env node

import { createCommander } from "@phragon/cli-commander";
import { join } from "path";
import build from "./build";
import watch from "./watch";
import { installPhragonJS } from "./plugins/installer";
import { debug } from "./debug";
import compiler from "./compiler";
import type { Watch, InstallPhragonJSOptions } from "./types";

const pg = require(join(__dirname, "package.json"));
const cmd = createCommander({
	prompt: "phragon",
	version: pg.version,
	description: `${pg.name} ${pg.description || ""}`,
});

cmd("make")
	.description("Compiles the project files")
	.strict(true)
	.action(async () => {
		debug(`Trying to make ./phragon compiled files...`);
		await compiler();
		debug(`Compilation completed`);
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
	.strict(true)
	.action<never, Watch.CMDOptions>(async (_, options) => {
		debug(`Start {cyan development} mode`, options);
		await watch(options);
		return -1;
	});

cmd("build")
	.description("Make build")
	.option("--dev", "Build development mode")
	.strict(true)
	.action<never, { dev: boolean }>(async (_, options) => {
		const mode = options.dev ? "development" : "production";
		debug(`Make {cyan ${mode}} build`);
		await build(mode);
		return 0;
	});

cmd("install")
	.description("Install plugin")
	.option("--render", { alt: "-R", type: "value", description: "Render driver name" })
	.strict(true)
	.action<string | null, InstallPhragonJSOptions>(async (_, parameters) => {
		await installPhragonJS(parameters);
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
