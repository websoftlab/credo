import { debug as cliDebug, debugEnable, debugSetNamespacePrefix } from "@phragon/cli-debug";
import { color, format } from "@phragon/cli-color";

debugSetNamespacePrefix("phragon:");
debugEnable(process.env.DEBUG || "phragon:*");

export interface CmdDebug {
	(formatter: any, ...args: any[]): void;
	readonly isTTY: boolean;
	wait(id?: string, isStart?: boolean): CmdDebugWaiter;
	write(formatter: any, ...args: any[]): void;
	error(formatter: any, ...args: any[]): void;
}

export interface CmdDebugWaiter {
	readonly id: string;
	readonly opened: boolean;
	progress: number;
	start(): void;
	end(message?: string | number | Buffer): void;
	write(message: string | number | Buffer): void;
}

const waiter = "⣷⣯⣟⡿⢿⣻⣽⣾";

function createDebug(): CmdDebug {
	function toStr(formatter: any) {
		if (formatter == null) {
			return "";
		}
		if (formatter instanceof Error) {
			formatter = formatter.stack || formatter.message;
		}
		return typeof formatter === "object" && typeof formatter.toString === "function"
			? formatter.toString() + ""
			: String(formatter);
	}

	if (!process.stdout.isTTY) {
		function cmdDebug(formatter: any, ...args: any) {
			cliDebug(formatter, ...args);
		}

		cmdDebug.isTTY = false;
		cmdDebug.write = cmdDebug;
		cmdDebug.error = (formatter: any, ...args: any) => {
			cliDebug.error(formatter, ...args);
		};
		cmdDebug.wait = function wait(id = "progress"): CmdDebugWaiter {
			function _write(message: string | number | Buffer) {
				cmdDebug(`[${id}] ${toStr(message)}`);
			}
			return {
				get id() {
					return id;
				},
				get opened() {
					return false;
				},
				progress: 0,
				start() {},
				end(message) {
					if (message) {
						_write(message);
					}
				},
				write(message) {
					_write(message);
				},
			};
		};

		return Object.freeze(cmdDebug);
	}

	const stream = process.stdout;
	const stdoutWrite = process.stdout.write;
	const stderrWrite = process.stderr.write;

	function streamWrite(...args: any[]) {
		stdoutWrite.apply(process.stdout, args as never);
	}

	let isWait = false;
	let waitIntervalId: NodeJS.Timeout;
	let waitLast = ["[-]", "Progress..."];
	let waitI = 0;
	let writePrevent = false;
	let isError = false;

	const waiterList: CmdDebugWaiter[] = [];

	// @ts-ignore
	process.stdout.write = function (chunk: any, ...args: any[]) {
		if (!isWait || writePrevent) {
			return streamWrite(chunk, ...args);
		}
		_start();
		chunk = toStr(chunk);
		streamWrite(chunk);
		if (!chunk.endsWith("\n")) {
			streamWrite("\n");
		}
	};

	// @ts-ignore
	process.stderr.write = function (chunk: any, ...args: any[]) {
		if (!isWait || writePrevent) {
			return stderrWrite.call(this, chunk, ...args);
		}
		_start();
		chunk = toStr(chunk);
		stderrWrite.call(this, chunk);
		if (!chunk.endsWith("\n")) {
			stderrWrite.call(this, "\n");
		}
	};

	function _writePrevent<T>(func: () => T): T {
		const prev = writePrevent;
		writePrevent = true;
		const result = func();
		writePrevent = prev;
		return result;
	}

	// to start
	function _start() {
		_writePrevent(() => {
			streamWrite("\x1b[0G");
			stream.clearLine(1);
		});
	}

	function _write(start: number, max: number, text: string, colorize: (text: string) => string) {
		return _writePrevent(() => {
			const limit = max - start;
			if (limit <= 0) {
				return start;
			}

			let len = text.length;
			if (len < 1) {
				return start;
			}

			if (len > limit) {
				len = limit;
				text = text.substring(0, limit);
			}
			if (colorize) {
				text = colorize(text);
			}
			streamWrite(text);

			return start + len;
		});
	}

	function _update() {
		_start();

		const max = stream.columns;
		const [prefix, message] = waitLast;

		let n = 0;
		let total = 0;
		let progress = 0;

		waiterList.forEach((item) => {
			if (item.opened) {
				progress += item.progress;
				total += 1;
			}
		});

		const text = " " + ((((progress / total) * 100) >> 0) + "%").padStart(4, ".");

		n = _write(n, max, waiter[waitI], color.cyan);
		n = _write(n, max, text, color.white);
		n = _write(n, max, " " + prefix, color.yellow);

		_write(n, max, " " + message, color.grey);
		_writePrevent(() => {
			streamWrite("\x1b[0G");
		});
	}

	function cmdDebugTTY(formatter: any, ...args: any[]) {
		if (formatter instanceof Error) {
			isError = true;
		}
		if (isWait) {
			_start();
		}

		_writePrevent(() => {
			formatter = format(toStr(formatter), ...args);
			streamWrite(isError ? color.red("$ ") : color.cyan("$ "));
			streamWrite(formatter.endsWith("\n") ? formatter.slice(0, -1) : formatter);
			streamWrite("\n");
			isError = false;
		});

		if (isWait) {
			_update();
		}
	}

	cmdDebugTTY.wait = function wait(id = "progress", isStart = false) {
		let item: CmdDebugWaiter | undefined = waiterList.find((item) => item.id === id);
		if (item) {
			if (isStart) {
				item.start();
			}
			return item;
		}

		let opened = false;
		let progress = 0;

		function open() {
			if (opened) {
				return;
			}

			opened = true;
			progress = 0;

			if (!isWait) {
				isWait = true;
				waitIntervalId = setInterval(() => {
					_update();
					if (++waitI === waiter.length) {
						waitI = 0;
					}
				}, 150);

				// hide cursor
				_writePrevent(() => {
					streamWrite("\x1B[?25l");
				});
			}

			_update();
		}

		item = {
			id,
			get opened() {
				return opened;
			},
			set progress(value) {
				progress = value < 0 ? 0 : value > 1 ? 1 : value;
			},
			get progress() {
				return progress;
			},
			write(message) {
				open();
				message = toStr(message).trim();
				if (message.length) {
					waitLast = [`[${id}]`, message];
				}
			},
			start() {
				open();
			},
			end(message) {
				if (!opened) {
					return;
				}
				opened = false;
				if (!waiterList.some((item) => item.opened)) {
					isWait = false;
					clearInterval(waitIntervalId);
					waitLast = ["[-]", "Progress..."];
					_start();

					// show cursor
					_writePrevent(() => {
						streamWrite("\x1B[?25h");
					});
				}
				if (message || message === 0) {
					cmdDebugTTY(color.yellow(`[${id}]`), toStr(message));
				}
			},
		};

		waiterList.push(item);

		if (isStart) {
			open();
		}

		return item;
	};

	cmdDebugTTY.isTTY = true;
	cmdDebugTTY.write = cmdDebugTTY;
	cmdDebugTTY.error = function (formatter: any, ...args: any[]) {
		isError = true;
		cmdDebugTTY(formatter, ...args);
	};

	return cmdDebugTTY;
}

export const debug: CmdDebug = createDebug();
