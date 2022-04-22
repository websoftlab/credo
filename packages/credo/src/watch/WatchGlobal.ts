import type { Stats } from "fs";
import { watch, watchFile, unwatchFile, existsSync, statSync } from "fs";
import { join } from "path";
import { newError } from "@credo-js/cli-color";

export interface WatchEntry {
	path: string;
	type: "file" | "directory";
	required: boolean;
}

export interface WatchNode {
	file: string;
	entry: WatchEntry;
	unsubscribe(): void;
	tick(...args: any[]): void;
}

export interface WatchEvent {
	type: "file" | "directory";
	file: string;
	action: string;
	stat?: Stats;
}

export interface WatchFunction {
	(event: WatchEvent): void;
}

export default class WatchGlobal {
	private _noWatchId: null | NodeJS.Timeout = null;
	private readonly _nodes: WatchNode[] = [];
	private readonly _notExistsNodes: WatchNode[] = [];
	private readonly _handler: WatchFunction;

	started: boolean = false;

	private _createNode(entry: WatchEntry): WatchNode {
		const file = join(process.cwd(), entry.path);
		const node = {
			file,
			unsubscribe() {},
			entry,
			tick:
				entry.type === "file"
					? (stat: Stats) => {
							if (stat.size === 0 && !existsSync(file)) {
								this._checkNode(node);
								this._handler({ action: "delete", type: "file", file });
							} else {
								this._handler({ action: "change", type: "file", file, stat });
							}
					  }
					: (type: string, file: string) => {
							this._handler({ action: type, type: "directory", file });
					  },
		};
		return node;
	}

	private _stopNoExistsWatch() {
		if (this._noWatchId) {
			clearInterval(this._noWatchId);
			this._noWatchId = null;
		}
	}

	private _checkNode(node: WatchNode) {
		const { entry, file } = node;
		if (entry.required && !existsSync(file)) {
			throw newError(`The {yellow ./%s} ${entry.type} not found`, entry.path);
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
				this._checkNode(node);
				node.unsubscribe();
				node.tick("delete", file);
				this._notExistsNodes.push(node);
				this._watchNoExists();
			});
			node.unsubscribe = () => {
				wt.close();
				node.unsubscribe = () => {};
			};
			if (emit) {
				node.tick("create", file);
			}
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
					this._handler({
						action: "create",
						type: node.entry.type,
						file: node.file,
					});
					this._watchNode(node, true);
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
			this._checkNode(node);
		}
		for (const node of this._nodes) {
			const { file, entry } = node;
			if (entry.type === "file" || existsSync(file)) {
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
			this._checkNode(node);
			this._watchNode(node);
		}
	}
}
