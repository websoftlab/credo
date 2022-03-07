import type {CredoJSCron, Server} from "../types";
import {createCredoJS, BootMgr} from "../credo";
import nodeSchedule from "./nodeSchedule";

export default async function cronService(options: Server.Options = {}) {

	const {
		registrar: registrarOption,
		cronMode = "service",
		... rest
	} = options;

	if(!["service", "worker"].includes(cronMode)) {
		throw new Error(`Invalid cron service mode (${cronMode})`);
	}

	const registrar = registrarOption || new BootMgr();
	const credo: CredoJSCron = await createCredoJS<CredoJSCron>(rest, {
		mode: "cron",
		cluster: cronMode === "service",
	}, {
		cronMode,
		cron: {},
	});

	// load & bootstrap
	await (await registrar.load(credo))();

	const cron = credo.config("cron");

	// cron
	try {
		await nodeSchedule(credo, cron.jobs || [])
	} catch(err) {
		credo.debug.error("cron jobs failure", err);
		throw err;
	}

	return credo;
}