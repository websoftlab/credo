import cluster from "cluster";
import server from "./server";
import { debug } from "@phragon/cli-debug";
import { cpus } from "os";
import daemon from "./daemon";
import type { Worker, Server } from "./types";

const cpuCount = cpus().length;

function productionOnly() {
	if (process.env.NODE_ENV !== "production") {
		throw new Error("Run worker only production mode");
	}
}

export async function masterProcess(processes: Worker.Cluster[]) {
	productionOnly();
	if (!processes || !Array.isArray(processes) || processes.length < 1) {
		throw new Error("Processes list is empty");
	}

	const dmn = daemon();

	dmn.init(true);

	debug.worker(`Master process {blue %s} is running`, process.pid);

	type Part = {
		id: string;
		mid: number;
		numberOfRestarts: number;
		part: number;
		mode: "app" | "cron";
		workerPart: number;
		env: Record<string, string>;
	};

	const parts: Part[] = [];
	const idn: Record<string, number> = {};

	function pidToPart(pid: number | string) {
		const id = String(pid);
		if (!idn.hasOwnProperty(id)) {
			throw new Error("Fatal worker error, PID data lost");
		}
		return parts[idn[id]];
	}

	const fork = (data?: number | string | Part, failure: boolean = false) => {
		if (data == null) {
			throw new Error("Fatal worker error, PID is null");
		}

		if (typeof data === "number" || typeof data === "string") {
			const pid = String(data);
			data = pidToPart(pid);
			delete idn[pid];
		}

		if (failure) {
			data.numberOfRestarts++;
		}

		const { mid, id, mode, numberOfRestarts, part, env, workerPart } = data;

		debug.worker(
			`Forking process {cyan %s} mode {blue %s}, part {blue %s}, number {blue %s}...`,
			id,
			mode,
			part,
			workerPart
		);

		const worker = cluster.fork({
			...env,
			NODE_ENV: "production",
			APP_MODE: "cluster",
			APP_ID: id,
		});

		idn[String(worker.process.pid)] = part;

		const workerData: Worker.Data = {
			id,
			mid,
			pid: process.pid,
			part: workerPart,
			mode,
			numberOfRestarts,
		};

		worker.send(workerData, undefined, (err: Error | null) => {
			if (err) {
				debug.error("Send worker error", err);
			}
		});
	};

	let calcCount = 0;
	let isCron = false;

	processes.forEach((item) => {
		let { env = {}, count = 1, mid, id, mode } = item;

		const cron = mode === "cron";
		if (cron) {
			if (isCron) {
				throw new Error(`Cron service duplicate`);
			}
			isCron = true;
		}

		if (cron && count !== 1) {
			throw new Error(`Cron service duplicate (limit > 1)`);
		}

		calcCount += count;
		for (let i = 0; i < count; i++) {
			const part = parts.length;
			parts.push({
				env,
				mid,
				id,
				mode,
				part,
				workerPart: i + 1,
				numberOfRestarts: 0,
			});
		}
	});

	if (calcCount > cpuCount) {
		debug.error(`{red WARNING!} CPU core count < cluster workers count, {yellow ${cpuCount}} < {red ${calcCount}}`);
	}

	cluster.on("exit", (worker, code, signal) => {
		const pid = worker.process.pid;
		const wdt = pidToPart(pid);
		debug.error("Worker pid {blue %d} died ({red %s}). Restarting...", pid, signal || code);
		fork(pid, true);

		// add restart count
		dmn.send({
			type: "restart",
			id: wdt.id,
			pid: dmn.pid,
			cid: pid,
			part: wdt.workerPart,
		});
	});

	function isV16Cluster(cluster: any): cluster is { isPrimary: boolean; setupPrimary: Function } {
		return "setupPrimary" in cluster && typeof cluster.setupPrimary === "function";
	}

	// hide windows
	const sett: any = {
		windowsHide: true,
	};

	if (isV16Cluster(cluster)) {
		cluster.setupPrimary(sett);
	} else {
		cluster.setupMaster(sett);
	}

	// fork workers.
	parts.forEach((part) => {
		fork(part);
	});
}

export function childProcess(options: Server.Options) {
	productionOnly();
	return new Promise((resolve, reject) => {
		process.once("message", (workerData: Worker.Data) => {
			const { process: proc } = options;

			if (proc?.id !== workerData.id) {
				throw new Error("Process IDs do not match (Worker.Data[id] vs Server.Options[process].id)");
			}

			if (cluster.worker) {
				Object.defineProperty(cluster.worker, "workerData", {
					value: workerData,
					enumerable: true,
					configurable: false,
					writable: false,
				});
			}

			server(options).then(resolve).catch(reject);
		});
	});
}
