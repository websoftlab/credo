import readLine from "readline";
import { EventEmitter } from "events";

export class Terminal extends EventEmitter {
	stream: NodeJS.WriteStream & { fd: 1 };
	write: (message: string) => void;
	native: (call: (stream: NodeJS.WriteStream & { fd: 1 }) => void) => void;

	constructor() {
		super();

		this.stream = process.stdout;
		if (!this.stream.isTTY) {
			throw new Error("Terminal requires TTY support");
		}

		readLine.emitKeypressEvents(process.stdin);

		process.stdin.setRawMode(true);
		process.stdin.on("keypress", (str, key) => {
			if (key.ctrl && key.name === "c") {
				process.exit(0);
			} else {
				this.emit("keypress", str, key);
			}
		});

		let w = 0,
			h = 0;
		const resize = () => {
			w = this.stream.columns;
			h = this.stream.rows;
		};

		resize();
		process.stdout.on("resize", () => {
			const prevW = w,
				prevH = h;
			resize();
			this.emit("resize", { prevW, prevH, w, h });
		});

		let prevent = false;

		const self = this;
		const nativeWrite = process.stdout.write;
		const nativeErrWrite = process.stderr.write;

		const nativeWriteEvn = function (...args: any[]) {
			return nativeWrite.apply(process.stdout, args as never);
		};
		const nativeErrWriteEvn = function (...args: any[]) {
			return nativeErrWrite.apply(process.stderr, args as never);
		};

		// @ts-ignore
		process.stdout.write = function (...args: any[]) {
			if (prevent) {
				nativeWriteEvn(...args);
			} else {
				self.emit("data", {
					data: args[0],
					error: false,
					native: nativeWriteEvn,
					nativeWrite() {
						nativeWriteEvn(...args);
					},
				});
			}
		};

		// @ts-ignore
		process.stderr.write = function (...args: any[]) {
			self.emit("data", {
				data: args[0],
				error: true,
				native: nativeErrWriteEvn,
				nativeWrite() {
					nativeErrWriteEvn(...args);
				},
			});
		};

		// write content to output stream
		this.write = (message: string) => {
			prevent = true;
			process.stdout.write(message);
			prevent = false;
		};

		this.native = (func: Function) => {
			prevent = true;
			func(process.stdout);
			prevent = false;
		};
	}

	// get terminal width & height
	get width() {
		return this.stream.columns;
	}

	get height() {
		return this.stream.rows;
	}

	// save cursor position + settings
	cursorSave() {
		this.write("\x1B7");
	}

	// restore last cursor position + settings
	cursorRestore() {
		this.write("\x1B8");
	}

	// show/hide cursor
	cursor(enabled: boolean) {
		if (enabled) {
			this.write("\x1B[?25h");
		} else {
			this.write("\x1B[?25l");
		}
	}

	// change cursor position
	cursorTo(x?: number, y?: number) {
		this.native((stream) => {
			readLine.cursorTo(stream, x || 0, y);
		});
	}

	// clear to the right from cursor
	clearRight() {
		this.native((stream) => {
			readLine.clearLine(stream, 1);
		});
	}

	// clear everything beyond the current line
	clearBottom() {
		this.native((stream) => {
			readLine.clearScreenDown(stream);
		});
	}

	// add new line; increment counter
	newline() {
		this.write("\n");
	}
}

const TERM_KEY = Symbol();

function getTerm(stream: any): Terminal {
	if (!stream[TERM_KEY]) {
		stream[TERM_KEY] = new Terminal();
	}
	return stream[TERM_KEY];
}

export default function getTerminal() {
	return getTerm(process.stdout);
}
