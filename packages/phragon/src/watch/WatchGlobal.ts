import type { Stats } from "node:fs";
import { watch, watchFile, unwatchFile, existsSync, statSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { newError } from "@phragon/cli-color";

export type WatchAction = "change" | "delete" | "create";

export interface WatchEntry {
	path: string;
	type: "file" | "directory";
	required: boolean;
	test?: (action: WatchAction, file: string, stats?: Stats) => boolean;
}

export interface WatchNode {
	file: string;
	entry: WatchEntry;
	unsubscribe(): void;
	tick(...args: any[]): void;
}

export interface WatchEvent {
	file: string;
	action: WatchAction;
	stat?: Stats;
}

export interface WatchFunction {
	(event: WatchEvent): void;
}

function checkNode(node: WatchNode) {
	const { entry, file } = node;
	if (entry.required && !existsSync(file)) {
		throw newError(`The {yellow ./%s} ${entry.type} not found`, entry.path);
	}
}

export default class WatchGlobal {
	private _noWatchId: null | NodeJS.Timeout = null;
	private _files: Record<string, { size: number; exists: boolean }> = {};
	private _dirs: string[] = [];
	private readonly _nodes: WatchNode[] = [];
	private readonly _notExistsNodes: WatchNode[] = [];
	private readonly _handler: WatchFunction;

	started: boolean = false;

	private _readDir(prefix: string, ref: boolean = false) {
		if (ref) {
			prefix = realpathSync(prefix);
		}

		if (this._dirs.includes(prefix)) {
			return;
		}

		this._dirs.push(prefix);

		const files = readdirSync(prefix);
		for (const file of files) {
			let path = join(prefix, file);
			let stat = lstatSync(path);

			if (stat.isSymbolicLink()) {
				path = realpathSync(path);
				stat = statSync(path);
			}

			if (stat.isFile()) {
				if (!this._files.hasOwnProperty(path)) {
					this._files[path] = {
						size: stat.size,
						exists: true,
					};
				}
			} else if (stat.isDirectory()) {
				this._readDir(path);
			}
		}
	}

	private _emitAction(node: WatchNode, file: string, stats?: Stats) {
		const { entry } = node;
		const size = stats ? stats.size : 0;
		const exists = size === 0 ? existsSync(file) : true;

		let action: WatchAction = "change";
		let found = this._files.hasOwnProperty(file) ? this._files[file] : null;

		if (!exists) {
			action = "delete";
			if (entry.type === "file") {
				checkNode(node);
			}
		} else if (!found || !found.exists) {
			action = "create";
		}

		if (!found) {
			this._files[file] = { size, exists };
			if (entry.type === "file" || (entry.test && !entry.test(action, file, stats))) {
				return null;
			}
			return action;
		}

		let emit = found.size !== size || found.exists !== exists;
		if (emit) {
			found.size = size;
			found.exists = exists;
			if (entry.test && !entry.test(action, file, stats)) {
				emit = false;
			}
		}

		return emit ? action : null;
	}

	private _createNode(entry: WatchEntry): WatchNode {
		const file = join(process.cwd(), entry.path);

		let node: WatchNode;
		let tick: (...args: any[]) => void;

		if (entry.type === "file") {
			tick = (stat: Stats) => {
				const action = this._emitAction(node, file, stat);
				if (action) {
					this._handler({ action, file, stat });
				}
			};
		} else {
			const prefix = file;
			tick = (_: string, file: string) => {
				// normalize file name
				if (!file) {
					file = prefix;
				} else {
					if (file.endsWith("~")) {
						file = file.slice(0, -1);
					}
					file = resolve(prefix, file);
				}

				// real path
				file = realpathSync(file);

				let stat: Stats | undefined;
				if (existsSync(file)) {
					stat = statSync(file);
					if (stat.isDirectory()) {
						if (!this._dirs.includes(file)) {
							this._dirs.push(file);
						}
						return;
					}
					if (!stat.isFile()) {
						return;
					}
				} else if (prefix === file) {
					return checkNode(node);
				} else {
					const index = this._dirs.indexOf(file);
					if (index !== -1) {
						this._dirs.splice(index, 1);
						return;
					}
				}

				const action = this._emitAction(node, file, stat);
				if (action) {
					this._handler({ action, file, stat });
				}
			};
		}

		node = {
			file,
			unsubscribe() {},
			entry,
			tick,
		};

		return node;
	}

	private _stopNoExistsWatch() {
		if (this._noWatchId) {
			clearInterval(this._noWatchId);
			this._noWatchId = null;
		}
	}

	private _watchNode(node: WatchNode, emit: boolean = false) {
		const { file, entry } = node;
		if (entry.type === "directory") {
			const wt = watch(file, { recursive: true }, node.tick);
			wt.on("error", (err) => {
				if (existsSync(file)) {
					throw err;
				}
				checkNode(node);
				node.unsubscribe();
				node.tick("delete", file);
				this._notExistsNodes.push(node);
				this._watchNoExists();
			});
			node.unsubscribe = () => {
				wt.close();
				node.unsubscribe = () => {};
			};
		} else {
			watchFile(file, node.tick);
			node.unsubscribe = () => {
				unwatchFile(file, node.tick);
				node.unsubscribe = () => {};
			};
			if (emit && existsSync(file)) {
				node.tick(statSync(file));
			}
		}
	}

	private _watchNoExists() {
		if (this._noWatchId != null || this._notExistsNodes.length < 1) {
			return;
		}

		this._noWatchId = setInterval(() => {
			const copy = this._notExistsNodes.slice();
			for (const node of copy) {
				if (existsSync(node.file)) {
					this._watchNode(node);
					this._notExistsNodes.splice(this._notExistsNodes.indexOf(node), 1);
				}
			}
			if (this._notExistsNodes.length === 0) {
				this._stopNoExistsWatch();
			}
		}, 2000);
	}

	constructor(handler: WatchFunction) {
		let id: null | NodeJS.Timeout = null;
		this._handler = (event) => {
			if (id) {
				clearTimeout(id);
				id = null;
			}
			id = setTimeout(() => {
				id = null;
				handler(event);
			}, 300);
		};
	}

	start() {
		if (this.started || !this._nodes.length) {
			return;
		}
		this.started = true;
		for (const node of this._nodes) {
			checkNode(node);
		}
		for (const node of this._nodes) {
			const { file, entry } = node;
			if (entry.type === "file" || existsSync(file)) {
				if (entry.type === "directory") {
					this._readDir(node.file, true);
				}
				this._watchNode(node);
			} else {
				this._notExistsNodes.push(node);
			}
		}
		this._watchNoExists();
	}

	stop() {
		if (!this.started) {
			return;
		}
		this.started = false;
		this._stopNoExistsWatch();
		this._nodes.forEach((node) => node.unsubscribe());
	}

	add(entry: WatchEntry) {
		const node = this._createNode(entry);
		if (this._nodes.findIndex((n) => n.file === node.file) !== -1) {
			return;
		}
		this._nodes.push(node);
		if (this.started) {
			checkNode(node);
			this._watchNode(node, entry.type === "file");
		}
	}
}
