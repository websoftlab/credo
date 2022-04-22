import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { isMainProcess } from "../utils";
import cluster from "cluster";
import { isMainThread, workerData, parentPort } from "worker_threads";
import { debug } from "@credo-js/cli-debug";
import { newError } from "@credo-js/cli-color";
import { spawn } from "child_process";
import createCPUTick from "./createCPUTick";
import type { DaemonCPUValue, DaemonSendCPU, DaemonSendData, DaemonPIDFileData, DaemonOptions } from "./types";

function parent(): number {
	if (cluster.isWorker) {
		const pid = cluster.worker?.workerData?.pid || null;
		if (pid) {
			return pid;
		}
	}

	if (!isMainThread && workerData && typeof workerData.pid === "number") {
		return workerData.pid;
	}

	return 0;
}

type SendCallback = (message: DaemonSendData) => void;

export default class Daemon {
	private _send: SendCallback | null = null;
	private _init: boolean = false;
	private _stop: Function | null = null;
	private _options: DaemonOptions;

	private _data: DaemonPIDFileData = {
		pid: 0,
		start: -1,
		latest: -1,
		end: -1,
		cpu: {},
		lastError: null,
	};

	constructor() {
		const options: DaemonOptions = {
			delay: 5000,
			cpuPoint: 180,
			killSignal: "SIGTERM",
			pid: join(process.cwd(), "./credo-pid.json"),
		};
		const confFile = join(process.cwd(), "credo-daemon.json");
		if (existsSync(confFile)) {
			Object.assign(options, JSON.parse(readFileSync(confFile).toString()));
		}
		this._options = options;
		this.update();
	}

	private _update(upd?: Partial<DaemonPIDFileData>) {
		if (upd) {
			Object.assign(this._data, upd);
			if (upd.start) {
				this._data.end = -1;
				this._data.lastError = null;
			}
		}
		this._data.latest = Date.now();
		writeFileSync(this._options.pid, JSON.stringify(this._data, null, 2));
	}

	private _updateStop(end?: number, lastError: string | null = null) {
		if (!end) {
			end = Date.now();
		}
		this._update({
			pid: 0,
			end,
			lastError,
		});
	}

	private _sendSignal(signal?: string) {
		const { pid } = this._data;
		if (!pid) {
			return 0;
		}

		try {
			process.kill(pid, signal || 0);
			return pid;
		} catch (err) {}

		return 0;
	}

	send(message: DaemonSendData) {
		if (!this._init || message.pid !== this.pid) {
			return;
		}

		if (this._send) {
			return this._send(message);
		}

		if (!this.isPrimary) {
			return;
		}

		const id = `${message.id}/${message.part}`;

		let row = this._data.cpu[id];
		if (message.type === "restart") {
			if (row) {
				row.restarted++;
			}
			return;
		}

		if (!row) {
			row = {
				id: message.id,
				part: message.part,
				port: message.port || null,
				host: message.host || null,
				mode: message.mode || null,
				type: "main",
				restarted: 0,
				pid: message.cid,
				cpu: [],
			};
			this._data.cpu[id] = row;
		}

		row.pid = message.cid;

		if (message.type === "detail") {
			row.port = message.port || null;
			row.host = message.host || null;
			row.mode = message.mode || null;
		} else {
			row.type = message.type;

			// add cpu
			row.cpu.push(message.cpu);
			while (row.cpu.length > this._options.cpuPoint) {
				row.cpu.shift();
			}

			// update data
			if (row.pid === this.pid) {
				this._update();
			}
		}
	}

	start(args: string[], env: Record<string, string>, background: boolean = true) {
		this.update();

		if (this.started) {
			throw new Error("Server already started!");
		}

		if (!isMainProcess()) {
			throw new Error("It is permissible to stop the server only in the main thread!");
		}

		const file = join(process.cwd(), "build/server/server.js");
		if (!existsSync(file)) {
			throw new Error("Build server file not found");
		}

		const subprocess = spawn(process.argv[0], [file].concat(args), {
			cwd: process.cwd(),
			detached: background,
			stdio: background ? "ignore" : "inherit",
			env,
		});

		const pid = subprocess.pid;
		if (background) {
			subprocess.unref();
		}

		this._update({
			pid,
			start: Date.now(),
			cpu: {},
		});
	}

	init(server: boolean = false) {
		this.update();

		if (!this.started) {
			if (process.argv.includes("--no-pid")) {
				return debug("Warning: PID ignore...");
			}
			throw newError("Use {cyan --no-pid} flag for run server");
		}

		const it = this;
		if (it._init) {
			return;
		}

		function createListener(
			callback: (value: DaemonCPUValue) => DaemonSendData,
			main: boolean = false,
			stopListeners: Function[] = []
		) {
			const onExit = (err?: Error) => {
				if (main) {
					it._updateStop(undefined, err ? err.message : null);
				}
			};

			const onSend = (value: DaemonCPUValue) => {
				it.send(callback(value));
			};

			const stop = createCPUTick(it._options.delay, onSend, onExit, stopListeners);

			it._init = true;
			it._stop = (msg?: string) => {
				stop(msg);
				it._init = false;
				it._stop = null;
				it._send = null;
			};
		}

		if (this.isChild) {
			if (!isMainThread && workerData && workerData.pid === it.pid && parentPort) {
				it._send = (msg: DaemonSendData) => {
					parentPort?.postMessage(msg);
				};
				return createListener((cpu: DaemonCPUValue) => {
					return <DaemonSendCPU>{
						type: "worker",
						id: "cron",
						pid: it.pid,
						part: 1,
						cid: process.pid,
						host: null,
						mode: null,
						port: null,
						cpu,
					};
				});
			}

			const wData = cluster.worker.workerData;
			const send = process.send;
			if (!wData) {
				throw newError("Child process error: {cyan %s} is not defined", "cluster.worker.workerData");
			}
			if (!send) {
				throw newError("Child process error: {cyan %s} function not defined", "process.send");
			}

			it._send = (msg: DaemonSendData) => {
				send.call(process, msg);
			};
			return createListener((cpu: DaemonCPUValue) => {
				return <DaemonSendCPU>{
					type: "fork",
					id: wData.id,
					pid: it.pid,
					part: wData.part,
					cid: process.pid,
					host: null,
					mode: null,
					port: null,
					cpu,
				};
			});
		}

		if (!this.isPrimary) {
			throw new Error("Server already started!");
		}

		const stopListeners: Function[] = [];

		if (server) {
			function message(_: any, msg: any) {
				if (msg && msg.pid === it.pid && (msg.type === "fork" || msg.type === "detail")) {
					it.send(msg);
				}
			}
			cluster.addListener("message", message);
			stopListeners.push(() => {
				cluster.removeListener("message", message);
			});
		}

		createListener(
			(cpu: DaemonCPUValue) => {
				return {
					type: server ? "cluster" : "main",
					id: "main",
					pid: it.pid,
					cid: process.pid,
					part: 1,
					host: null,
					mode: null,
					port: null,
					cpu,
				};
			},
			true,
			stopListeners
		);
	}

	stop() {
		this.update();

		if (!this.started) {
			return;
		}

		if (!isMainProcess()) {
			throw new Error("It is permissible to stop the server only in the main thread!");
		}

		if (this.isPrimary) {
			let code = 0;
			if (this._stop) {
				this._stop("System aborted...");
			} else {
				code = 1;
			}
			return process.exit(code);
		}

		if (this._stop) {
			return this._stop("System aborted...");
		}

		this._sendSignal(this._options.killSignal);

		this.update();
		if (this.started && this._sendSignal() === 0) {
			this._updateStop();
		}
	}

	update() {
		if (this._data.pid === process.pid) {
			return this;
		}
		if (!existsSync(this._options.pid)) {
			return this;
		}
		const text = readFileSync(this._options.pid).toString();
		if (!text) {
			return this;
		}
		Object.assign(this._data, JSON.parse(text));
		if (
			this._data.pid !== 0 &&
			Date.now() - this._data.latest > this._options.delay + 5000 &&
			this._sendSignal() === 0
		) {
			this._updateStop(this._data.latest, "Unknown error, process stopped responding");
		}
		return this;
	}

	get isPrimary() {
		return isMainThread && this._data.pid === process.pid;
	}

	get isChild() {
		const data = this._data;
		if (data.pid === 0) {
			return false;
		}
		const cid = parent();
		if (data.pid === cid) {
			return isMainThread ? cluster.isWorker && data.pid !== process.pid : cid === process.pid;
		}
		return false;
	}

	get started() {
		return this._data.pid !== 0;
	}

	get pid() {
		return this._data.pid;
	}

	get cpu() {
		return this._data.cpu;
	}

	get startTime() {
		return this._data.start;
	}

	get endTime() {
		return this._data.end;
	}

	get latestTime() {
		return this._data.latest;
	}

	get lastError() {
		return this._data.lastError;
	}

	get delta() {
		return this.started ? Date.now() - this.startTime : 0;
	}
}
