import { cwdPath, exists, readJsonFile, writeJsonFile } from "../utils";
import { debugError } from "../debug";

type JsonFileInstallData = {
	installed: boolean;
	lock: boolean;
	time: number;
	lastError: string | null;
	lastDuration: number;
	plugins: Record<string, any>;
};

const jsonFileInstallPath = cwdPath("phragon.json.install");
const FI_KEY = Symbol();

export default class JsonFileInstall {
	[FI_KEY]: JsonFileInstallData = {
		installed: false,
		lock: false,
		time: Date.now(),
		lastError: null,
		lastDuration: 0,
		plugins: {},
	};

	get lock() {
		return this[FI_KEY].lock;
	}

	get time() {
		return this[FI_KEY].time;
	}

	get plugins() {
		return this[FI_KEY].plugins;
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

	plugin(name: string) {
		return this[FI_KEY].plugins[name];
	}

	has(name: string): boolean {
		return this[FI_KEY].plugins.hasOwnProperty(name);
	}

	async load() {
		if (await exists(jsonFileInstallPath)) {
			this[FI_KEY] = await readJsonFile(jsonFileInstallPath);
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

		async function update(time: number) {
			gen.time = time;
			await writeJsonFile(jsonFileInstallPath, gen);
		}

		const start = Date.now();

		gen.lock = true;

		await update(start);

		const done = (err?: Error) => {
			const time = Date.now();
			gen.lock = false;
			gen.lastDuration = time - start;
			gen.lastError = err ? err.message : null;
			process.off("exit", listener);

			return update(time).catch((err) => {
				debugError("{yellow %s} write failure", "./phragon.json.install", err);
			});
		};

		const listener = (code: number) => {
			if (gen.lock) {
				done(new Error("Process exit code " + code));
			}
		};

		process.on("exit", listener);

		return done;
	}
}
