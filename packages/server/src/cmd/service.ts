import type {Server} from "../types";
import type {CredoJSCmd} from "./types";
import cluster from "cluster";
import {isMainThread} from "worker_threads";
import createCmd from "./createCmd";
import {createCredoJS, BootMgr} from "../credo";

export default async function cmdService(options: Server.Options = {}) {
	if(!isMainThread || !cluster.isPrimary) {
		throw new Error("Command line not available in cluster worker mode");
	}

	const args = process.argv.slice(2);
	const name = args.shift();
	if(!name) {
		throw new Error("Command name not specified");
	}

	const {registrar: registrarOption, ... rest} = options;

	const credo: CredoJSCmd = await createCredoJS<CredoJSCmd>(rest, {
		mode: "cmd",
		cluster: false,
	}, {});

	if(credo.envMode !== "production") {
		throw new Error("Command line not available in development mode");
	}

	const cmd = createCmd(credo, name, args);

	Object.defineProperty(credo, "cmd", {
		get() { return cmd; },
		enumerable: true,
		configurable: false,
	});

	// load & bootstrap, run cmd
	const registrar = options.registrar || new BootMgr();
	await (await registrar.load(credo))();
	await cmd.run();
}