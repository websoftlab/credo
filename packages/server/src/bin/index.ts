#!/usr/bin/env node

import { createCommander } from "@phragon/cli-commander";
import { format } from "@phragon/cli-color";
import cmdStop from "./cmdStop";
import cmdStart from "./cmdStart";
import cmdStatus from "./cmdStatus";
import cmdStat from "./cmdStat";
import cmdCmd from "./cmdCmd";
import util from "util";

const commander = createCommander({
	prompt: "phragon",
	version: require("../package.json").version,
	description: "Working with the server in production mode",
	stream: process.stderr,
});

commander("cmd").description("Command shell for internal operations").action(cmdCmd);

commander("status").description("Server status").strict().action(cmdStatus);

commander("stat").description("Server CPU statistics").strict().action(cmdStat);

commander("stop").description("Stop server").strict().action(cmdStop);

function errorFlag(name: string) {
	return {
		throwable: true,
		message: format(
			"Use the {cyan %s} flag to run the main server file {darkGray %s}",
			name,
			"./build/server/server.js"
		),
	};
}

commander("start")
	.description("Start server")
	.strict()
	.error("--no-pid", errorFlag("--no-pid"))
	.error("--no-cron", errorFlag("--no-cron"))
	.error("--cron", errorFlag("--cron"))
	.option("--host", { alt: "-H", type: "value", description: "Server host (0.0.0.0 default)" })
	.option("--port", {
		alt: "-P",
		type: "value",
		description: "Server port (3000 default)",
		format: "port",
		name: "number",
	})
	.option("--background", "Run server in background")
	.action(cmdStart);

commander
	.begin()
	.then((code) => {
		if (code !== -1) {
			process.exit(code);
		}
	})
	.catch((err) => {
		process.stderr.write(util.format("Server failure", err));
		process.exit(1);
	});
