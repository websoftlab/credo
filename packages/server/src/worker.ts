import cluster from "cluster";
import server from "./server";
import {debug} from "@credo-js/utils/srv/index";
import {cpus} from "os";
import type {Worker, Server} from "./types";

const cpuCount = cpus().length;

if(process.env.ENV_MODE !== "production") {
	throw new Error("Run worker only production mode");
}

export function masterProcess(processes: Worker.Cluster[]) {
	if(!processes || !Array.isArray(processes) || processes.length < 1) {
		throw new Error("Processes list is empty")
	}

	debug.worker(`Master process {blue %s} is running`, process.pid);

	type Part = {
		id: number;
		cid: string;
		numberOfRestarts: number;
		part: number;
		mode: "app" | "cron";
		workerPart: number;
		env: Record<string, string>;
	};

	const parts: Part[] = [];
	const idn: Record<string, number> = {};

	const fork = (data?: number | string | Part, failure: boolean = false) => {
		if(data == null) {
			throw new Error("Fatal worker error, PID is null");
		}

		if(typeof data === "number" || typeof data === "string") {
			const pid = String(data);
			if(!idn.hasOwnProperty(pid)) {
				throw new Error("Fatal worker error, PID data lost");
			}
			data = parts[idn[pid]];
			delete idn[pid];
		}

		if(failure) {
			data.numberOfRestarts ++;
		}

		const {
			id,
			cid,
			mode,
			numberOfRestarts,
			part,
			env,
			workerPart,
		} = data;

		debug.worker(`Forking process number {blue %s}...`, workerPart);

		const worker = cluster.fork({
			... env,
			NODE_ENV: "production",
			APP_MODE: "cluster",
			APP_CID: cid,
		});

		idn[String(worker.process.pid)] = part;

		worker.send(JSON.stringify({id, cid, part: workerPart, mode, numberOfRestarts}), (err) => {
			if(err) {
				debug.error("Send worker error", err);
			}
		});
	};

	let calcCount = 0;
	let isCron = false;

	processes.forEach(item => {
		let {
			env = {},
			count = 1,
			id,
			cid,
			mode,
		} = item;

		const cron = mode === "cron";
		if(cron) {
			if(isCron) {
				throw new Error(`Cron service duplicate`);
			}
			isCron = true;
		}

		if(cron && count !== 1) {
			throw new Error(`Cron service duplicate (limit > 1)`);
		}

		calcCount += count;
		for(let i = 0; i < count; i++) {
			const part = parts.length;
			parts.push({
				env,
				id,
				cid,
				mode,
				part,
				workerPart: i + 1,
				numberOfRestarts: 0,
			});
		}
	});

	if(calcCount > cpuCount) {
		debug.error(`{red WARNING!} CPU core count < cluster workers count, {yellow ${cpuCount}} < {red ${calcCount}}`);
	}

	cluster.on("exit", (worker, code, signal) => {
		const pid = worker.process.pid;
		debug.error('Worker pid {blue %d} died ({red %s}). Restarting...', pid, signal || code);
		fork(pid, true);
	});

	// fork workers.
	parts.forEach(part => {
		fork(part);
	});
}

export function childProcess(options: Server.Options) {
	process.once('message', (data: string) => {
		const workerData: Worker.Data = JSON.parse(data);
		const {process: proc} = options;

		if(proc?.cid !== workerData.cid) {
			throw new Error("Process IDs do not match (Worker.Data[cid] vs Server.Options[process].cid)");
		}

		if(cluster.worker) {
			cluster.worker.workerData = workerData;
		}

		server(options).catch((err) => {
			debug.error('Server failure', err);
			process.exit(1);
		});
	});
}
