import type {Server} from "../types";
import type {CredoJSCmd} from "./types";
import {createCredoJS, BootMgr} from "../credo";
import {isMainProcess} from "../utils";
import {Commander} from "@credo-js/cli-commander";

export default async function cmdService(options: Server.Options = {}) {
	if(!isMainProcess()) {
		throw new Error("Running the command line is only allowed on the main thread!");
	}

	const {registrar: registrarOption, ... rest} = options;

	const credo: CredoJSCmd = await createCredoJS<CredoJSCmd>(rest, {
		mode: "cmd",
		cluster: false,
	}, {});

	if(credo.envMode !== "production") {
		throw new Error("Command line not available in development mode");
	}

	const cmd = new Commander({
		prompt: "credo cmd",
		version: require("../package.json").version,
		description: "Command shell for internal operations",
	});

	credo.define("cmd", cmd);

	// load & bootstrap, run cmd
	const registrar = registrarOption || new BootMgr();
	await (await registrar.load(credo))();

	return cmd.begin();
}