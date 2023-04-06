import { cwdPath, exists, readJsonFile, writeJsonFile } from "../utils";
import { debug } from "../debug";
import { writeFileSync } from "node:fs";

interface JsonFileInstallData {
	installed: boolean;
	lock: boolean;
	time: number;
	lastError: string | null;
	lastDuration: number;
	hash?: string;
	plugins: Record<string, { version: string; details: any }>;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
}

const jsonFileInstallPath = cwdPath("phragon.json.install");
const FI_KEY = Symbol();
const FI_TRANSACTION = Symbol();

function defaultData(): JsonFileInstallData {
	return {
		installed: false,
		lock: false,
		time: Date.now(),
		lastError: null,
		lastDuration: 0,
		plugins: {},
		dependencies: {},
		devDependencies: {},
	};
}

export class JsonFileInstall {
	[FI_TRANSACTION] = false;
	[FI_KEY]: JsonFileInstallData = defaultData();

	get hash() {
		return this[FI_KEY].hash || "";
	}

	get lock() {
		return this[FI_KEY].lock;
	}

	get time() {
		return this[FI_KEY].time;
	}

	get plugins() {
		return this[FI_KEY].plugins;
	}

	set hash(value: string) {
		this[FI_KEY].hash = value;
	}

	set installed(value: boolean) {
		if (this[FI_KEY].lock) {
			this[FI_KEY].installed = value;
		}
	}

	get installed() {
		return this[FI_KEY].installed;
	}

	get lastError() {
		return this[FI_KEY].lastError;
	}

	get lastDuration() {
		return this[FI_KEY].lastError;
	}

	get inTransaction() {
		return this[FI_TRANSACTION];
	}

	plugin(name: string) {
		return this[FI_KEY].plugins[name];
	}

	has(name: string): boolean {
		return this[FI_KEY].plugins.hasOwnProperty(name);
	}

	setDependency(name: string, version?: string | null) {
		if (!this.inTransaction) {
			return;
		}
		if (version == null) {
			delete this[FI_KEY].dependencies[name];
		} else {
			this[FI_KEY].dependencies[name] = version;
		}
	}

	setDevDependency(name: string, version?: string | null) {
		if (!this.inTransaction) {
			return;
		}
		if (version == null) {
			delete this[FI_KEY].devDependencies[name];
		} else {
			this[FI_KEY].devDependencies[name] = version;
		}
	}

	getDependency(name: string) {
		return this[FI_KEY].dependencies[name] || null;
	}

	getDevDependency(name: string) {
		return this[FI_KEY].devDependencies[name] || null;
	}

	async load() {
		// ignore command
		if (this.inTransaction) {
			return;
		}
		if (await exists(jsonFileInstallPath)) {
			this[FI_KEY] = {
				...defaultData(),
				...(await readJsonFile(jsonFileInstallPath)),
			};
		}
	}

	async transaction(callback: Function) {
		if (typeof callback !== "function") {
			throw new Error("Transaction callback must be function");
		}

		const done = await this.createTransaction();

		try {
			await callback();
		} catch (err) {
			await done(err as Error);
			return err;
		}

		return done();
	}

	async save() {
		if (this.inTransaction) {
			await writeJsonFile(jsonFileInstallPath, this[FI_KEY]);
		}
	}

	async createTransaction() {
		if (this[FI_KEY].lock) {
			throw new Error("Installation transaction already open");
		}

		// reload all
		await this.load();

		const gen = this[FI_KEY];
		if (gen.lock) {
			throw new Error("Installation transaction already open");
		}

		let fatal = false;
		this[FI_TRANSACTION] = true;

		const update = async (time: number) => {
			gen.time = time;
			await this.save();
		};

		const start = Date.now();

		gen.lock = true;

		await update(start);

		const done = (err?: Error) => {
			const time = Date.now();
			gen.lock = false;
			gen.lastDuration = time - start;
			gen.lastError = err ? err.message || "Unknown error" : null;
			process.off("exit", listener);

			// write sync for fatal error
			if (fatal) {
				gen.time = time;
				this[FI_TRANSACTION] = false;
				writeFileSync(jsonFileInstallPath, JSON.stringify(gen, null, 2));
			} else {
				return update(time)
					.finally(() => {
						this[FI_TRANSACTION] = false;
					})
					.catch((err) => {
						debug.error("{yellow %s} write failure", "./phragon.json.install", err);
					});
			}
		};

		const listener = (code: number) => {
			if (gen.lock) {
				fatal = true;
				done(new Error("Process exit code " + code));
			}
		};

		process.on("exit", listener);

		return async (err?: Error) => done(err);
	}
}

let jsonFile: JsonFileInstall | null = null;

export function installJson() {
	if (jsonFile == null) {
		jsonFile = new JsonFileInstall();
	}
	return jsonFile;
}
