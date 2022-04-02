import isWindows from "is-windows";
import {fork} from "child_process";
import {asyncResult} from "@credo-js/utils";
import {exists} from "../utils";
import {join as joinPath} from "path";
import {debugError, debugWatch} from "../debug";
import {format} from "@credo-js/cli-color";
import type {ChildProcessByStdio} from "child_process";
import type {Watch, BuildOptions, BuildType} from "../types";

function unsubscribe<T>(collection: T[], item: T) {
	const index = collection.indexOf(item);
	if(index !== -1) {
		collection.splice(index, 1);
	}
}

function subscriber<T>(collection: T[], item: T, valid?: (item: T) => boolean) {
	if(valid && !valid(item)) {
		return () => {};
	}
	if(!collection.includes(item)) {
		collection.push(item);
	}
	return () => {
		unsubscribe(collection, item);
	};
}

export default function createWatchServe(buildOptions: BuildOptions, opts: {
	host?: string,
	port?: number | string,
	devHost?: string,
	devPort?: number | string,
	ssr?: boolean,
}): Watch.Serve {

	let {
		host = "",
		port = 1278,
		devHost = "",
		devPort = 1277,
		ssr = false,
	} = opts;

	let child: ChildProcessByStdio<any, any, any> | null = null;
	let init = false;
	let isWait = false;
	let restart = false; // restart repeat after run
	let restartForce = false;

	if(!devHost) {
		devHost = isWindows() ? '127.0.0.1' : '0.0.0.0';
	}

	if(!host) {
		host = isWindows() ? '127.0.0.1' : '0.0.0.0';
	}

	const serverFile = joinPath(process.cwd(), "dev/server/server.js");
	const events: Partial<Record<Watch.EventName | "onDebug", Function[]>> = {};

	async function emit<T>(name: Watch.EventName | "onDebug", argument?: T, throwable: boolean = true) {
		const listeners = events[name];
		if(listeners) {
			for(let listener of listeners) {
				try {
					await asyncResult(listener(argument));
				} catch(err: any) {
					if(err && typeof err.message === "string") {
						err.message = format(`Watch event {cyan %s} failure. %s`, name, err.message);
					}
					if (name === "onError") {
						debugError("OnError failure", err);
					} else {
						await emit("onError", err, false);
					}
					if(throwable) {
						throw err;
					}
				}
			}
		}
	}

	type ErrorContext = Error & {context?: string[]};

	const errors: ErrorContext[] = [];
	const isStr = (item: any): item is string => typeof item === "string";

	function emitDebug(text: string, context: BuildType | "system", error: boolean = false) {
		emit("onDebug", {text, context, error}, false).catch(() => {});
	}

	function emitError<T extends ErrorContext = ErrorContext>(err: T, context?: string): T {
		if(!Array.isArray(err.context)) {
			err.context = isStr(err.context) ? [err.context] : [];
		}
		if(context && !err.context.includes(context)) {
			err.context.push(context);
		}

		// ignore duplicate
		if(errors.includes(err)) {
			return err;
		}

		errors.push(err);
		while(errors.length > 10) {
			errors.shift();
		}

		emit("onError", err, false).catch(() => {});
		return err;
	}

	async function abort() {
		if(isWait) {
			throw new Error("Server restart, wait...");
		}

		isWait = true;
		return new Promise<void>((resolve) => {
			if(!child) {
				isWait = false;
				return resolve();
			}

			const id = setTimeout(() => { child && child.kill(); }, 10000);

			child.on("message", (message) => {
				const match = String(message).match(/^pong (.+?)$/);
				if(match) {
					child && child.send(`exit ${match[1]}`);
				} else if(message && typeof message === "string") {
					emitError(new Error(message), "server kill");
				}
			});

			child.on("close", () => {
				clearTimeout(id);
				isWait = false;
				resolve();
			});

			child.send("ping");
		});
	}

	async function rerun(force: boolean, initial: boolean = false) {

		if(isWait) {
			restart = true;
			restartForce = force;
			return;
		}

		debugWatch(`Try {cyan %s} server`, child ? "restart" : "start");

		await abort();

		// build server file
		await emit("onBeforeStart", {... buildOptions, force, initial});

		if(!await exists(serverFile)) {
			throw emitError(new Error("Server runner file not found!"));
		}

		isWait = true;

		return new Promise<void>((resolve, reject) => {
			const env: Record<string, string> = {
				... process.env,
				DEV_SERVER_HOST: devHost,
				DEV_SERVER_PORT: String(devPort),
				CREDO_HOST: host,
				CREDO_PORT: String(port),
			};

			if(buildOptions.cluster) {
				env.APP_ID = buildOptions.cluster.id;
			}

			try {
				child = fork(serverFile, {
					stdio: buildOptions.progressLine ? 'pipe' : 'inherit',
					env,
				});
			} catch(err) {
				return reject(emitError(err as Error));
			} finally {
				isWait = false;
			}

			if(buildOptions.progressLine) {
				child.stdout.on("data", (data: string) => {
					emitDebug(data.toString(), "system", false);
				});
				child.stderr.on("data", (data: string) => {
					emitDebug(data.toString(), "system", true);
				});
			}

			child.on("error", (err) => {
				if(!isWait) {
					emitError(err, "Server failure");
				}
			});

			child.on("close", () => {
				child = null;
			});

			resolve();

			emit("onAfterStart", {... buildOptions, force, initial}).finally(() => {
				if(restart) {
					restart = false;
					rerun(restartForce).catch(err => {
						emitError(err, "Watch restart server failure");
					});
				}
			});
		});
	}

	const runner: Watch.Serve = {
		get mode() {
			return buildOptions.mode;
		},
		get factory() {
			return buildOptions.factory;
		},
		get cluster() {
			return buildOptions.cluster;
		},
		get initialized() {
			return init;
		},
		get started() {
			return Boolean(child);
		},
		get progressLine() {
			return buildOptions.progressLine;
		},
		get ssr() {
			return ssr;
		},
		async start() {
			if(init) {
				throw new Error("Watching has already started");
			}
			await emit("onInit");
			init = true;
			return rerun(false, true);
		},
		async restart(options?: BuildOptions) {
			if(!init) {
				throw new Error("Watching has not started");
			}
			let force = false;
			if(options) {
				buildOptions = options;
				force = true;
				await emit("onChangeOptions", options);
			}
			return rerun(force);
		},
		emitError,
		emitDebug,
		on(name: Watch.EventName | "onDebug", listener: Function) {
			if(!events[name]) {
				events[name] = [];
			}
			return subscriber(events[name] as Function[], listener, (listener) => typeof listener === "function");
		},
		off(name: Watch.EventName, listener?: Function) {
			if(events[name]) {
				if(!listener) {
					delete events[name];
				} else {
					unsubscribe(events[name] as Function[], listener);
				}
			}
		},
		async abort(err?: Error) {
			if(err) {
				emitError(err);
			}
			try {
				await abort();
				await emit("onAbort", err);
			} finally {
				process.exit(1);
			}
		},
		createTrigger(): Watch.Trigger {

			let init = false, resolve: Function, reject: Function;
			let closed = false;

			function update(err?: Error) {
				if(err) {
					runner.emitError(err);
				} else {
					runner
						.restart()
						.catch(err => {
							runner.emitError(err, "Sever restart failure");
						});
				}
			}

			return {
				promise: new Promise<void>((resolve1, reject1) => {
					resolve = resolve1;
					reject = reject1;
				}),
				update(err?: Error) {
					if(closed) {
						if(!init) {
							init = true;
							reject(new Error("Abort"));
						}
					} else if(init) {
						update(err);
					} else {
						init = true;
						if(err) {
							reject(err);
						} else {
							resolve();
						}
					}
				},
				close() {
					closed = true;
				}
			};
		}
	};

	return runner;
};
