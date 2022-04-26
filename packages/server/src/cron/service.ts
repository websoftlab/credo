import type { PhragonJSCron, Server } from "../types";
import { createPhragonJS, BootManager } from "../phragon";
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
	const phragon: PhragonJSCron = await createPhragonJS<PhragonJSCron>(
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
		await registrar.load(phragon)
	)();

	const cron = phragon.config("cron");
	if (!cron.enabled) {
		throw new Error("Cron disabled...");
	}

	// cron
	try {
		await nodeSchedule(phragon, cron.jobs || []);
	} catch (err) {
		phragon.debug.error("cron jobs failure", err);
		throw err;
	}

	phragon.debug("CRON Server is running [{cyan %s} jobs]", cron.jobs.length);

	if (isProd) {
		const dmn = daemon();
		dmn.send({
			type: "detail",
			id: "cron",
			pid: dmn.pid,
			cid: process.pid,
			part: (phragon.process && cluster.worker?.workerData?.part) || 1,
			port: null,
			host: null,
			mode: phragon.mode,
		});
	}

	return phragon;
}
