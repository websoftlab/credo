import type { Server } from "../types";
import type { PhragonJSCmd } from "./types";
import { createPhragonJS, BootManager } from "../phragon";
import { isMainProcess } from "../utils";
import { Commander } from "@phragon/cli-commander";

export default async function cmdService(options: Server.Options = {}) {
	if (!isMainProcess()) {
		throw new Error("Running the command line is only allowed on the main thread!");
	}

	const { registrar: registrarOption, ...rest } = options;

	const phragon: PhragonJSCmd = await createPhragonJS<PhragonJSCmd>(
		rest,
		{
			mode: "cmd",
			cluster: false,
		},
		{}
	);

	if (phragon.envMode !== "production") {
		throw new Error("Command line not available in development mode");
	}

	const cmd = new Commander({
		prompt: "phragon cmd",
		version: require("../package.json").version,
		description: "Command shell for internal operations",
	});

	phragon.define("cmd", cmd);

	// load & bootstrap, run cmd
	const registrar = registrarOption || new BootManager();
	await (
		await registrar.load(phragon)
	)();

	return cmd.begin();
}
