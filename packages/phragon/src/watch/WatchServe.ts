import { newError } from "@phragon/cli-color";
import compiler from "../compiler";
import createWatch from "../rollup/createWatch";
import type { RollupWatcher } from "rollup";
import type { PhragonPlugin, Watch } from "../types";
import type { CmdDebugWaiter } from "../debug";
import isWindows from "is-windows";
import { RollupBuild, RollupWatcherEvent } from "rollup";
import { ChildProcessByStdio, fork } from "child_process";
import { cwdPath } from "../utils";
import { EventEmitter } from "events";
import { debug } from "../debug";
import { isPlainObject } from "@phragon-util/plain-object";

function isEventResult(event: any): event is { result: RollupBuild } {
	return event && event.result != null;
}

function getConfigCluster(id: string | undefined, factory: PhragonPlugin.Factory) {
	const { cluster: clusterList } = factory;
	if (clusterList.length) {
		if (!id) {
			return clusterList[0];
		}
		for (const cluster of clusterList) {
			if (cluster.id === id) {
				return cluster;
			}
		}
		throw newError(`The {yellow %s} cluster not found!`, id);
	}
	return undefined;
}

async function abortWatcher(serve: WatchServe) {
	const watcher = serve.watcher;
	if (!watcher) {
		return;
	}
	serve.watcher = null;
	try {
		watcher.removeAllListeners();
		await watcher.close();
	} catch (err: any) {
		serve.emit("error", err);
	}
}

function killChildProcess(child: ChildProcessByStdio<any, any, any>, throwable: boolean = true) {
	if (!child.killed && !child.kill() && throwable) {
		throw new Error("Cannot kill last server process");
	}
	child.removeAllListeners("error");
	child.removeAllListeners("close");
	child.stdout.removeAllListeners("data");
	child.stderr.removeAllListeners("data");
}

function abortChildProcess(serve: WatchServe) {
	const child = serve.child;
	if (!child) {
		return false;
	}
	serve.child = null;
	killChildProcess(child);
	return true;
}

function isMessageProgress(
	message: any
): message is { event: { message: string; progress: number | null; done: boolean } } {
	return isPlainObject(message) && message.action === "progress";
}

export default class WatchServe extends EventEmitter implements Watch.Serve {
	_restartRepeat: boolean = false;
	_restartStop: boolean = false;
	_restartWaiter: Promise<boolean> | null = null;
	_options: Required<Watch.CMDOptions>;
	_bundleID = 1;
	_waiter: CmdDebugWaiter;

	watcher: RollupWatcher | null = null;
	child: ChildProcessByStdio<any, any, any> | null = null;
	factory: PhragonPlugin.Factory | null = null;

	get port(): number {
		return this._options.port;
	}
	get devPort(): number {
		return this._options.devPort;
	}
	get host(): string {
		return this._options.host;
	}
	get devHost(): string {
		return this._options.devHost;
	}
	get ssr(): boolean {
		return this._options.ssr;
	}
	get clusterId(): string | null {
		return this._options.cluster || null;
	}
	get cluster(): PhragonPlugin.ClusterOptions | undefined {
		const id = this._options.cluster;
		if (id && this.factory) {
			return getConfigCluster(id, this.factory);
		}
		return undefined;
	}
	get started() {
		return this.child ? !this.child.killed : false;
	}

	constructor(options: Watch.CMDOptions) {
		super();

		const {
			port = 1278,
			host = isWindows() ? "127.0.0.1" : "0.0.0.0",
			devPort = 1277,
			devHost = isWindows() ? "127.0.0.1" : "0.0.0.0",
			ssr = false,
			cluster = "",
		} = options;

		this._waiter = debug.wait("serve");
		this._options = {
			port,
			devPort,
			host,
			devHost,
			ssr,
			cluster,
		};
	}

	async start() {
		if (this.started) {
			return true;
		}
		return this.restart();
	}

	private async _restartServe(err?: Error) {
		const id = this._bundleID;
		const isAbort = () => id !== this._bundleID;

		if (err) {
			this.emit("error", err);
		}

		if (abortChildProcess(this)) {
			this.emit("stop");
			this._waiter.end();
		}

		if (err) {
			return;
		}

		this.emit("onBeforeStart");

		const serverFile = cwdPath("./dev/server/server.js");
		const env: Record<string, string> = {
			...process.env,
			DEV_SERVER_HOST: this.devHost,
			DEV_SERVER_PORT: String(this.devPort),
			PHRAGON_HOST: this.host,
			PHRAGON_PORT: String(this.port),
		};

		if (this.clusterId) {
			env.APP_ID = this.clusterId;
		}

		let child: ChildProcessByStdio<any, any, any> | null = null;
		try {
			child = fork(serverFile, {
				stdio: "pipe",
				env,
			});
		} catch (err: any) {
			this.emit("error", err);
		}

		if (isAbort() || !child) {
			if (child) {
				child.kill();
			}
			return;
		}

		this.child = child;

		child.stdout.on("data", (data: string | Buffer) => {
			debug.write(data);
		});

		child.stderr.on("data", (data: string | Buffer) => {
			debug.error(data);
		});

		child.on("error", (err) => {
			if (!isAbort()) {
				this.emit("error", err);
				if (child) {
					killChildProcess(child, false);
					child = null;
				}
				this.child = null;
				this.emit("stop");
				this._waiter.end();
			}
		});

		child.on("close", () => {
			child = null;
		});

		child.on("message", (data) => {
			if (isMessageProgress(data)) {
				const { message, done, progress } = data.event;
				if (done) {
					this._waiter.end();
				} else {
					this._waiter.write(message);
					if (progress != null) {
						this._waiter.progress = progress;
					}
				}
			}
		});

		this.emit("start");
	}

	private async _tryStart() {
		this.emit("onBeforeBuild");

		this.factory = await compiler("development");

		this.emit("build");

		const watcher = await createWatch({
			factory: this.factory,
			cluster: this.cluster,
			ssr: this.ssr,
		});

		let lastError: Error | false = false;
		let init = false;
		let ok: Function;

		const waiter = new Promise<void>((resolve) => {
			ok = resolve;
		});
		const restart = (err?: Error) => {
			if (err) {
				lastError = err;
			}
			if (this._bundleID === Number.MAX_SAFE_INTEGER) {
				this._bundleID = 1;
			} else {
				this._bundleID++;
			}
			if (!init) {
				init = true;
				ok();
			}
			this._restartServe(err).catch((err) => {
				this.emit("error", err);
			});
		};

		this.watcher = watcher;

		watcher.on("event", (event: RollupWatcherEvent) => {
			if (this.watcher !== watcher) {
				return;
			}

			if (event.code === "BUNDLE_START") {
				lastError = false;
				this._waiter.start();
			} else if (event.code === "ERROR") {
				restart(event.error as Error);
			} else if (event.code === "BUNDLE_END" && !lastError) {
				restart();
			}

			// This will make sure that bundles are properly closed after each run
			if (isEventResult(event)) {
				event.result.close().catch((err) => {
					this.emit("error", err);
					this._waiter.end();
				});
			}
		});

		return waiter;
	}

	private async _tryStop() {
		if (abortChildProcess(this)) {
			this.emit("stop");
		}

		// kill last watcher
		await abortWatcher(this);

		this.factory = null;
		this._waiter.end();
	}

	async restart() {
		if (this._restartWaiter) {
			this._restartRepeat = true;
			this._restartStop = false;
			return this._restartWaiter;
		}

		let ok: (done: boolean) => void;

		const waiter = new Promise<boolean>((resolve) => {
			ok = resolve;
		});

		this._restartWaiter = waiter;

		const done = (result: boolean, err?: Error) => {
			if (err) {
				this.emit("error", err);
			}
			setTimeout(() => {
				// reset
				this._restartWaiter = null;
				this._restartStop = false;
				this._restartRepeat = false;

				ok(result);
			}, 10);
			return waiter;
		};

		let isOk = false;

		do {
			this._restartRepeat = false;

			try {
				await this._tryStop();
			} catch (err: any) {
				return done(false, err);
			}

			if (this._restartStop) {
				return done(false);
			}

			try {
				await this._tryStart();
			} catch (err: any) {
				this.emit("error", err);
				continue;
			}

			isOk = true;
		} while (this._restartRepeat || this._restartStop);

		return done(isOk);
	}

	async stop() {
		if (this._restartWaiter) {
			this._restartRepeat = false;
			this._restartStop = true;
			return this._restartWaiter.then(() => {
				return !this.started;
			});
		}

		try {
			await this._tryStop();
		} catch (err: any) {
			this.emit("error", err);
			return false;
		}

		return true;
	}
}
