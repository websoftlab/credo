import { mixed } from "@credo-js/cli-color";
import stringWidth from "./strWidth";
import { createWriteStream } from "fs";
import { randomBytes } from "crypto";
import { cwdPath } from "../utils";
import type { Terminal } from "./Terminal";
import type { WriteStream } from "fs";
import ansiClean from "./ansiClean";
import prepareDebug from "./prepareDebug";

type BoardHelp = { key: string; text: string };
type BoardLog = { text: string; type: string; error: boolean };
type BoardLineLog = { line: string; error: boolean; tab: boolean };
type BoardType = "client" | "server" | "server-page";
type BoardTypeGroup<T> = { name: T; status: string; progress: number; message: string };
type BoardData = {
	logs: BoardLineLog[];
	helps: BoardHelp[];
	logPause: boolean;
	logY: number;
	logMaxY: number;
	types: {
		client: BoardTypeGroup<"client">;
		server: BoardTypeGroup<"server">;
		"server-page": BoardTypeGroup<"server-page">;
	};
};

const BOARD_PRV = Symbol();

const types: BoardType[] = ["client", "server", "server-page"];

const help: BoardHelp[] = [
	{ key: "Up", text: "Previous line" },
	{ key: "Down", text: "Next line" },
	{ key: "Home", text: "Go to home" },
	{ key: "End", text: "Go to end" },
	{ key: "Ctrl+C", text: "Stop process and exit (0)" },
	{ key: "P", text: "Pause Debugging" },
	{ key: "H", text: "Switch Debugger and Help Menu" },
	{ key: "E", text: "Erase debug bar" },
];

const cmd: Record<string, string> = {
	up: "up",
	down: "down",
	e: "erase",
	p: "pause",
	home: "home",
	end: "end",
	h: "help",
};

function createEmpty(): BoardData {
	return {
		logs: [],
		helps: [],
		logPause: false,
		logY: 0,
		logMaxY: 0,
		types: {
			client: { name: "client", status: "disabled", progress: 0, message: "" },
			server: { name: "server", status: "disabled", progress: 0, message: "" },
			"server-page": { name: "server-page", status: "disabled", progress: 0, message: "" },
		},
	};
}

function padStart(text: string, len: number, fill = " ") {
	const size = stringWidth(text);
	if (size < len) {
		text = "".padEnd(len - size, fill) + text;
	}
	return text;
}

function padEnd(text: string, len: number, fill = " ") {
	const size = stringWidth(text);
	if (size < len) {
		text += "".padEnd(len - size, fill);
	}
	return text;
}

function getKNum(val: number): string {
	if (val < 1000) {
		return String(val);
	}
	if (val > 9999) {
		return "+9K";
	}
	return `+${(val / 1000) >> 0}K`;
}

function createID() {
	return randomBytes(4).toString("hex");
}

function board(brd: Board): BoardPrivate {
	return brd[BOARD_PRV];
}

class BoardPrivate {
	historyLength = 100;
	lines: BoardLog[] = [];
	help = false;
	singleType = 0;
	singleChangeId?: NodeJS.Timeout;
	debugCount = 0;
	errorCount = 0;
	opened = false;

	w: number = 0;
	h: number = 0;
	single: boolean = false;
	short: boolean = false;
	border: boolean = false;
	debugger: boolean = false;
	startX: number = 0;
	realWidth: number = 0;

	id: string;
	logFile: string;
	term: Terminal;
	last: BoardData;
	next: BoardData;
	writeStream?: WriteStream;

	constructor(term: Terminal) {
		this.id = createID();
		this.logFile = cwdPath("./credo-watch.log");
		this.term = term;
		this.singleType = 0;
		this.last = createEmpty();
		this.next = createEmpty();
		this.calc();
	}

	open() {
		if (this.opened) {
			return;
		}

		this.opened = true;

		if (!this.writeStream) {
			this.writeStream = createWriteStream(this.logFile, {
				encoding: "utf-8",
				flags: "a",
			});
		}

		this.writeLog(false, "system", "OPEN LOG SESSION");

		this.term.cursor(false);
		this.term.cursorSave();

		this.singleChangeId = setInterval(() => {
			if (!this.single) {
				return;
			}

			this.singleType++;
			if (this.singleType === types.length) {
				this.singleType = 0;
			}

			this.update(true);
		}, 1500);

		this.update(true);
	}

	close() {
		if (!this.opened) {
			return;
		}

		this.opened = false;

		this.term.cursorTo(0, 0);
		this.term.clearBottom();
		this.term.cursorRestore();

		this.writeLog(false, "system", "CLOSE LOG SESSION");

		if (this.writeStream) {
			this.writeStream.close();
			this.writeStream = undefined;
		}

		this.singleChangeId && clearInterval(this.singleChangeId);
		this.singleChangeId = undefined;
	}

	// calc

	calc() {
		const w = this.term.width;
		const h = this.term.height;

		this.w = w;
		this.h = h;
		this.single = h < 3;
		this.short = this.single || h < 6 || w < 80;
		this.border = !this.short;
		this.debugger = this.border && h > 10;
		this.startX = this.border ? 2 : 0;
		this.realWidth = this.border ? w - 4 : w;

		this.calcLogs(null, false);
		if (this.help) {
			this.calcScroll(true);
		}
	}

	calcScroll(isEnd = false) {
		const length = this.help ? help.length : this.next.logs.length;
		const delta = this.h - 8;
		this.next.logMaxY = length > delta ? length - delta : 0;
		if (isEnd || this.next.logY > this.next.logMaxY) {
			this.next.logY = this.next.logMaxY;
		}
	}

	calcLogs(log: BoardLog | null, update: boolean) {
		let force = false;
		if (log) {
			this.lines.push(log);
			while (this.lines.length > this.historyLength) {
				force = true;
				this.lines.shift();
			}
		}

		if (!this.debugger) {
			if (this.next.logs.length !== 0) {
				this.next.logs = [];
			}
			return this.updateCounter();
		}

		let startIter = 0;
		if (log && !force) {
			startIter = this.lines.length - 1;
		}

		if (startIter === 0) {
			this.next.logs = [];
		}

		let error = false;
		let tab = false;
		let prevSpace = false;
		let text = "";

		const isEnd = this.last.logY === this.last.logMaxY;
		const width = this.realWidth - 8 - 2; // "debug > " & scroll
		const close = () => {
			if (text.length) {
				this.next.logs.push({ line: text, error, tab });
				text = "";
				tab = true;
				prevSpace = true;
			}
		};

		for (let i = startIter; i < this.lines.length; i++) {
			const line = this.lines[i];
			let start = 0;

			error = line.error;
			tab = false;
			prevSpace = true;

			while (start < line.text.length) {
				const code = line.text.charCodeAt(start);

				// 32 - space
				//  9 - tab
				if (code === 32 || code === 9) {
					if (!prevSpace) {
						text += " ";
						prevSpace = true;
					}
				}

				// 10 - new line
				else if (code === 10) {
					close();
				} else if (code > 32) {
					prevSpace = false;
					if (!text && !tab) {
						text += `[${line.type}] `;
					}
					text += line.text.charAt(start);
					if (text.length === width) {
						close();
						prevSpace = true;
					}
				}

				start++;
			}

			close();
		}

		if (!this.help) {
			this.calcScroll(isEnd);
			// update terminal
			if (update) {
				this.updateDebugger();
			}
		}

		if (update) {
			this.updateCounter();
		}
	}

	// write

	writeType(type: BoardType, force: boolean, statusLen = 0) {
		const { last, next } = this;
		const idx = {
			client: 0,
			server: 1,
			"server-page": 2,
		};

		// terminal size

		const y = this.single ? 0 : idx[type] + (this.short ? 0 : 1);
		const lt = last.types[type];
		const nt = next.types[type];

		last.types[type] = Object.assign({}, nt) as never;

		if (force || lt.status !== nt.status || lt.progress !== nt.progress || lt.message !== nt.message) {
			const { status, progress, message } = nt;
			const border = this.single ? " " : "   ";

			let prompt = "";
			prompt += this.single ? mixed.lightYellow(lt.name) : padEnd(mixed.lightYellow(lt.name), 12);
			prompt += border;

			if (progress === -1) {
				prompt += this.single ? "-" : "----";
			} else if (status === "disabled") {
				prompt += mixed.darkGray(this.single ? "-" : "----");
			} else {
				prompt += this.single ? mixed.white(`${progress}%`) : padStart(mixed.white(`${progress}%`), 4, " ");
			}

			let st = `[${status}]`;
			switch (status) {
				case "disabled":
					st = mixed.darkGray(st);
					break;
				case "error":
					st = mixed.red(st);
					break;
				case "watch":
					st = mixed.green(st);
					break;
				default:
					st = mixed.cyan(st);
					break;
			}

			prompt += border;
			prompt += statusLen ? padEnd(st, statusLen + 2) : st;
			prompt += border;

			let text = String(message);
			if (!text) {
				text = "-";
			}

			this.writePromptText(y, prompt, text);
		}
	}

	writeHead(y: number, text: string) {
		this.term.cursorTo(0, y);
		this.term.write(padEnd(`┌─ ${text} `, this.w - 1, "─") + "┐");
	}

	writeEmptyLine(yStart: number, yEnd: number) {
		while (yStart <= yEnd) {
			this.term.cursorTo(0, yStart);
			this.term.write("|".padEnd(this.w - 1, " ") + "|");
			if (yStart !== yEnd) {
				this.term.newline();
			}
			yStart++;
		}
	}

	writeEndLine(y: number) {
		this.term.cursorTo(0, y);
		this.term.write("└".padEnd(this.w - 1, "─") + "┘");
	}

	writeFooter(y: number) {
		this.term.cursorTo(0, y);
		this.term.write("View all logs: " + mixed.lightYellow("./credo-watch.log"));
		this.term.clearRight();
		this.updateCounter();
	}

	writePromptText(y: number, prompt: string, text: string, delta = 0) {
		const mLen = this.realWidth - stringWidth(prompt) - delta;
		if (text.length > mLen) {
			text = text.substring(0, mLen);
		} else if (text.length < mLen) {
			text = text.padEnd(mLen, " ");
		}
		this.term.cursorTo(this.startX, y);
		this.term.write(prompt);
		this.term.write(text);
	}

	writeLog(error: boolean, type: string, text: string) {
		if (this.writeStream) {
			this.writeStream.write(
				`${new Date().toISOString()} ${this.id} [${error ? "ERROR" : "DEBUG"}] - ${type} - ${JSON.stringify(
					text
				)}\n`,
				"utf-8"
			);
		}
	}

	// update

	updateWatch(force = false) {
		if (this.single) {
			return this.writeType(types[this.singleType], force);
		}

		let statusLen = 0;
		for (const type of types) {
			const len = this.next.types[type].status.length;
			if (len > statusLen) {
				statusLen = len;
			}
		}

		for (const type of types) {
			this.writeType(type, force, statusLen);
		}
	}

	updateCounter() {
		if (!this.border) {
			return;
		}

		let y;
		let text = "";

		if (this.debugger) {
			y = this.h - 1;
		} else if (this.h > 5) {
			y = 5;
		} else {
			return;
		}

		if (this.debugger) {
			text += `Help ${mixed.darkGray("[")}${mixed.lightYellow("H")}${mixed.darkGray("]")} | `;
		}

		text += mixed.lightCyan(getKNum(this.debugCount)) + " " + (this.debugCount === 1 ? "log" : "logs") + " | ";
		text += mixed.lightRed(getKNum(this.errorCount)) + " " + (this.errorCount === 1 ? "error" : "errors");
		text = padStart(text, 32);

		this.term.cursorTo(this.w - 32, y);
		this.term.write(text);
	}

	updateDebugger(force = false) {
		if (!this.debugger) {
			return;
		}

		if (force) {
			this.last.logs = [];
			this.last.helps = [];
		}

		const { h, next, last } = this;
		const forcePause = last.logPause !== next.logPause;
		const forceScroll = last.logY !== next.logY || last.logMaxY !== next.logMaxY;

		if (forcePause) {
			last.logPause = next.logPause;
		}

		if (forceScroll) {
			last.logY = next.logY;
			last.logMaxY = next.logMaxY;
		}

		if (this.help) {
			let len = 0;
			for (const hlp of help) {
				if (hlp.key.length > len) {
					len = hlp.key.length;
				}
			}
			for (let i = 0, j = next.logY, y = 6, end = h - 3; y <= end; i++, j++, y++) {
				const hlp = help[j];
				if (!hlp) {
					break;
				}
				if (last.helps[i] !== hlp) {
					last.helps[i] = hlp;

					const text =
						"Key   " +
						mixed.darkGray("[") +
						mixed.lightYellow(hlp.key) +
						mixed.darkGray("]") +
						"".padEnd(3 + len - hlp.key.length);

					this.writePromptText(y, text, hlp.text, 2);
				}
			}
		} else {
			for (let i = 0, j = next.logY, y = 6, end = h - 3; y <= end; i++, j++, y++) {
				const log = next.logs[j];
				if (!log) {
					break;
				}
				if (forcePause || last.logs[i] !== log) {
					last.logs[i] = log;
					const text = log.tab
						? "      - "
						: log.error
						? `${mixed.lightRed("error")} > `
						: `${mixed.lightCyan("debug")} > `;
					this.writePromptText(y, text, log.line, 2);
				}
			}
		}

		if (forceScroll || forcePause) {
			const delta = this.h - 9;
			let cur = 6;
			if (next.logY > 0) {
				if (next.logY === next.logMaxY) {
					cur += delta;
				} else {
					cur += Math.floor((delta * next.logY) / next.logMaxY);
				}
			} else if (next.logMaxY === 0) {
				cur += delta;
			}

			for (let y = 6, end = y + delta; y <= end; y++) {
				this.term.cursorTo(this.w - 3, y);
				this.term.write(y === cur ? "█" : mixed.darkGray("░"));
			}
		}
	}

	update(force = false) {
		if (!this.opened) {
			return;
		}

		if (force) {
			this.calc();

			const { h } = this;

			this.term.cursorTo(0, 0);
			this.term.clearBottom();

			if (this.border) {
				this.writeHead(0, `Watch ID: ${mixed.white(this.id)}`);
				this.writeEmptyLine(1, 3);
				this.writeEndLine(4);
				if (this.debugger) {
					this.writeHead(
						5,
						this.help
							? "Help menu"
							: this.next.logPause
							? `Debug & Error ────── ${mixed.cyan("[paused]")}`
							: "Debug & Error"
					);
					this.writeEmptyLine(6, h - 3);
					this.writeEndLine(h - 2);
					this.writeFooter(h - 1);
				} else if (this.h > 5) {
					this.writeFooter(5);
				}
			}
		}

		this.updateWatch(force);

		if (this.debugger) {
			this.updateDebugger(force);
		}
	}

	// commands

	cmdToggleHelp() {
		if (this.debugger) {
			this.help = !this.help;
			this.next.logY = 0;
			this.calcScroll(!this.help);
			this.update(true);
		}
	}

	cmdUp() {
		if (this.debugger && this.next.logY > 0) {
			this.next.logY--;
			this.updateDebugger();
		}
	}

	cmdDown() {
		if (this.debugger && this.next.logY < this.next.logMaxY) {
			this.next.logY++;
			this.updateDebugger();
		}
	}

	cmdHome() {
		if (this.debugger && this.next.logY !== 0) {
			this.next.logY = 0;
			this.updateDebugger();
		}
	}

	cmdEnd() {
		if (this.debugger && this.next.logY !== this.next.logMaxY) {
			this.next.logY = this.next.logMaxY;
			this.updateDebugger();
		}
	}

	cmdErase() {
		if (this.debugger && !this.help && this.lines.length) {
			this.lines = [];
			this.update(true);
		}
	}

	cmdPause() {
		if (this.debugger && !this.help) {
			this.next.logPause = !this.next.logPause;
			this.update(true);
		}
	}

	// tools

	setMessage(type: BoardType, message: string) {
		this.next.types[type].message = message;
		this.updateWatch();
		if (message) {
			this.writeLog(false, type, message);
		}
	}

	setProgress(type: BoardType, progress: number, message: string) {
		const t = this.next.types[type];

		t.progress = progress;
		if (message != null) {
			t.message = message;
		}

		this.updateWatch();

		message = message || "---";
		if (progress !== -1) {
			message = `[progress ${progress}%] ${message}`;
		}

		this.writeLog(false, `progress ${type}`, message || "---");
	}

	setStatus(type: BoardType, status: string, message: string) {
		const nx = this.next.types[type];
		const ls = this.last.types[type];

		if (ls.status !== status) {
			nx.status = status;
			nx.progress = 0;
			nx.message = message;
		} else if (nx.message !== ls.message) {
			nx.message = message;
		} else {
			return;
		}

		this.updateWatch();
		this.writeLog(status === "error", `status ${type}`, message);
	}

	addLog(log: BoardLog) {
		const { text, type, error } = log;

		if (error) {
			this.errorCount++;
		} else {
			this.debugCount++;
		}

		this.writeLog(error, type, text);
		if (this.next.logPause) {
			return this.updateCounter();
		}

		this.calcLogs(log, true);
	}
}

class Board {
	[BOARD_PRV]: BoardPrivate;

	get opened() {
		return board(this).opened;
	}

	constructor(term: Terminal) {
		this[BOARD_PRV] = new BoardPrivate(term);
		const prv = board(this);

		term.on("data", (evn) => {
			if (!prv.opened) {
				evn.nativeWrite();
			} else {
				const text = ansiClean(evn.data);
				if (text.length) {
					const prepare = prepareDebug(text, "system", evn.error);
					if (prepare.type) {
						if (prepare.progress !== null) {
							return this.progress(prepare.type, prepare.progress, prepare.text);
						} else if (prepare.status !== null) {
							return this.status(prepare.type, prepare.status, prepare.text);
						}
					}
					if (prepare.text) {
						prv.addLog({ text: prepare.text, type: prepare.context, error: prepare.error });
					}
				}
			}
		});

		term.on("keypress", (_, key) => {
			if (cmd.hasOwnProperty(key.name)) {
				switch (cmd[key.name]) {
					case "help":
						return prv.cmdToggleHelp();
					case "up":
						return prv.cmdUp();
					case "down":
						return prv.cmdDown();
					case "home":
						return prv.cmdHome();
					case "end":
						return prv.cmdEnd();
					case "erase":
						return prv.cmdErase();
					case "pause":
						return prv.cmdPause();
				}
			}
		});

		term.on("resize", () => {
			if (prv.opened) {
				prv.update(true);
			}
		});
	}

	status(type: BoardType, status: string, message = "") {
		if (types.includes(type)) {
			board(this).setStatus(type, status, message);
		}
	}

	progress(type: BoardType, progress: number, message: string = "") {
		if (types.includes(type)) {
			board(this).setProgress(type, progress, message);
		}
	}

	message(type: BoardType, message: string = "") {
		if (types.includes(type)) {
			board(this).setMessage(type, message);
		}
	}

	log(text: string | Error, type: string | boolean = "system", error: boolean | null = null) {
		if (!text) {
			return;
		}

		if (typeof type === "boolean") {
			error = type;
			type = "system";
		}

		if (text instanceof Error) {
			text = text.stack || text.message;
			if (typeof error !== "boolean") {
				error = true;
			}
		} else if (typeof error !== "boolean") {
			error = false;
		}

		text = ansiClean(String(text)).trim();
		if (text.length > 0) {
			board(this).addLog({ text, type, error });
		}
	}

	open() {
		const prv = board(this);
		if (prv.opened) {
			throw new Error("Board is already opened");
		}
		prv.open();
	}

	close() {
		const prv = board(this);
		if (prv.opened) {
			prv.close();
		}
	}
}

export default Board;
