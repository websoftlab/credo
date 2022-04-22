import type { CredoJSCron, Server } from "../types";
import { createCredoJS, BootManager } from "../credo";
import nodeSchedule from "./nodeSchedule";
import daemon from "../daemon";
import cluster from "cluster";

export default async function cronService(options: Server.Options = {}) {
	const isProd = __PROD__ || options.mode === "production";
	if (isProd) {
		daemon().init();
	}

	const { registrar: registrarOption, cronMode = "service", ...rest } = options;

	if (!["service", "worker"].includes(cronMode)) {
		throw new Error(`Invalid cron service mode (${cronMode})`);
	}

	const registrar = registrarOption || new BootManager();
	const credo: CredoJSCron = await createCredoJS<CredoJSCron>(
		rest,
		{
			mode: "cron",
			cluster: cronMode === "service",
		},
		{
			cronMode,
			cron: {},
		}
	);

	// load & bootstrap
	await (
		await registrar.load(credo)
	)();

	const cron = credo.config("cron");
	if (!cron.enabled) {
		throw new Error("Cron disabled...");
	}

	// cron
	try {
		await nodeSchedule(credo, cron.jobs || []);
	} catch (err) {
		credo.debug.error("cron jobs failure", err);
		throw err;
	}

	credo.debug("CRON Server is running [{cyan %s} jobs]", cron.jobs.length);

	if (isProd) {
		const dmn = daemon();
		dmn.send({
			type: "detail",
			id: "cron",
			pid: dmn.pid,
			cid: process.pid,
			part: (credo.process && cluster.worker?.workerData?.part) || 1,
			port: null,
			host: null,
			mode: credo.mode,
		});
	}

	return credo;
}
