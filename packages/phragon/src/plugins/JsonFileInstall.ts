import { cwdPath, exists } from "../utils";
import { debug } from "../debug";
import { writeFileSync, openSync, unlinkSync, closeSync, constants } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { newError } from "@phragon/cli-color";

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

function wait(time: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, time);
	});
}

async function lockFile(n: number = 0): Promise<Function | null> {
	const lockPath = `${jsonFileInstallPath}.lock`;
	const now = Date.now();
	try {
		const id = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR);
		return () => {
			closeSync(id);
			try {
				unlinkSync(lockPath);
			} catch (err) {
				debug.error("Can't remove temporary file {%s}", "./phragon.json.install.lock");
			}
		};
	} catch (err) {
		if (n === 10) {
			return null;
		}
		if (n > 2) {
			debug("Waiting for previous build to complete {cyan (%s)}...", n - 2);
		}
		const waitTime = (n === 0 ? 100 : n * 500) - (Date.now() - now);
		await wait(waitTime > 50 ? waitTime : 50);
		return lockFile(n + 1);
	}
}

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
			let n = 0;
			let data: string;
			while (true) {
				data = (await readFile(jsonFileInstallPath)).toString();
				if (!data) {
					await wait(50);
				} else {
					break;
				}
				if (++n > 10) {
					throw newError("Can't read file {cyan ./%s}", "./phragon.json.install");
				}
			}
			this[FI_KEY] = {
				...defaultData(),
				...JSON.parse(data),
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
			await writeFile(jsonFileInstallPath, JSON.stringify(this[FI_KEY], null, 2));
		}
	}

	async tryWait() {
		if (this.inTransaction) {
			return false;
		}
		let count = 0;
		function sleep() {
			count++;
			if (count > 2) {
				debug("Waiting for previous build to complete {cyan (%s)}...", count - 2);
			}
			return wait(500 + count * 500);
		}
		while (count < 10) {
			await sleep();
			await this.load();
			if (!this.lock) {
				return true;
			}
		}
		return false;
	}

	async createTransaction(isWait = false) {
		const raw = () => this[FI_KEY];
		if (raw().lock) {
			throw new Error("Build transaction already open");
		}

		// reload all
		await this.load();

		if (raw().lock && (!isWait || !(await this.tryWait()))) {
			throw new Error("Build transaction already open");
		}

		const closeHandler = await lockFile();
		if (closeHandler == null) {
			throw new Error("Build transaction already open");
		}

		let fatal = false;
		this[FI_TRANSACTION] = true;

		const update = async (time: number) => {
			raw().time = time;
			await this.save();
		};

		const start = Date.now();

		raw().lock = true;

		await update(start);

		const done = (err?: Error) => {
			const time = Date.now();
			raw().lock = false;
			raw().lastDuration = time - start;
			raw().lastError = err ? err.message || "Unknown error" : null;
			process.off("exit", listener);

			// write sync for fatal error
			if (fatal) {
				raw().time = time;
				this[FI_TRANSACTION] = false;
				writeFileSync(jsonFileInstallPath, JSON.stringify(raw(), null, 2));
				closeHandler();
			} else {
				return update(time)
					.finally(() => {
						this[FI_TRANSACTION] = false;
						closeHandler();
					})
					.catch((err) => {
						debug.error("{yellow %s} write failure", "./phragon.json.install", err);
					});
			}
		};

		const listener = (code: number) => {
			if (raw().lock) {
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
