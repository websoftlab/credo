import type { LocalStore } from "./types";
import { mkdir, access, lstat, readdir, unlink, rmdir, opendir, writeFile, readFile } from "fs/promises";
import { dirname, sep, join as joinPath, resolve } from "path";
import asyncResult from "@phragon/utils/asyncResult";

const pathType = Symbol();

function resolvePath(store: LocalStoreData, path?: string | string[]) {
	const root = store[pathType];
	if (!path) {
		return root;
	}
	if (!Array.isArray(path)) {
		path = [path];
	}
	if (path.length === 0) {
		return root;
	}
	path = joinPath(root, ...path);
	if (path === root) {
		return path;
	}
	if (!path.startsWith(root + sep)) {
		throw new Error("Error accessing local storage");
	}
	return path;
}

async function checkExists(path: string) {
	try {
		await access(path);
	} catch (err) {
		return false;
	}
	return true;
}

async function checkDirectory(dir: string, dirname = "dirname") {
	if (!(await checkExists(dir))) {
		await mkdir(dir, { recursive: true });
	} else {
		const stat = await lstat(dir);
		if (!stat.isDirectory()) {
			throw new Error(`The ${dirname} is not directory (${dir})`);
		}
	}
}

async function checkFileOrNotExists(file: string) {
	if (await checkExists(file)) {
		const stat = await lstat(file);
		if (!stat.isFile()) {
			throw new Error(`The ${file} path is not file`);
		}
		return true;
	}
	return false;
}

async function checkFileDirectory(file: string) {
	await checkFileOrNotExists(file);
	await checkDirectory(dirname(file));
}

async function listFiles(
	files: LocalStore.FStats[],
	mask: (file: string, path: string | null) => boolean,
	hidden: boolean,
	base: string,
	path: string | null,
	depth: number,
	history: string[]
) {
	const fullPath = path ? joinPath(base, path) : base;
	const all = await readdir(fullPath);

	for (let file of all) {
		if (hidden && file.charAt(0) === ".") {
			continue;
		}
		const filePath = joinPath(fullPath, file);
		const stat = await lstat(filePath);
		if (stat.isFile()) {
			if (mask(file, path)) {
				files.push({
					base,
					file,
					path,
					fullPath: filePath,
					stats: stat,
				});
			}
		} else if (stat.isDirectory() && depth > 0) {
			const resolvePath = resolve(fullPath);
			if (!history.includes(resolvePath)) {
				history.push(resolvePath);
				await listFiles(files, mask, hidden, base, path ? `${path}/${file}` : file, depth - 1, history);
			}
		}
	}
}

async function list(
	store: LocalStoreData,
	stats: LocalStore.FStats[],
	history: string[],
	options: LocalStore.ListOptions
) {
	let { path, mask, depth = 0, hidden = false } = options;

	path = resolvePath(store, path);
	if (!(await checkExists(path))) {
		return stats;
	}

	const stat = await lstat(path);
	if (!stat.isDirectory()) {
		throw new Error(`The list path is not directory (${path})`);
	}

	if (mask) {
		if (typeof mask === "string") {
			const regExp = new RegExp(mask);
			mask = (file: string) => {
				return regExp.test(file);
			};
		} else if (mask instanceof RegExp) {
			const regExp = mask;
			mask = (file: string) => {
				return regExp.test(file);
			};
		} else if (typeof mask !== "function") {
			throw new Error("Invalid mask parameter");
		}
	} else {
		mask = () => true;
	}

	if (typeof depth !== "number" || depth < 1 || isNaN(depth) || !isFinite(depth)) {
		depth = 0;
	}

	await listFiles(stats, mask, hidden, path, null, depth, history);
}

export class StoreClearError extends Error {
	constructor(public files: LocalStore.FStats[], public removed: number) {
		super("Clear error");
	}
}

function createNotFoundError(file: string) {
	const err = new Error(`File not found ${file}`);
	(err as any).code = "ERR_MODULE_NOT_FOUND";
	return err;
}

export class LocalStoreData {
	[pathType]: string;

	constructor(path: string) {
		if (!path) {
			path = "./data";
		}
		if (path.charAt(0) === ".") {
			path = joinPath(process.cwd(), path);
		}
		this[pathType] = path;
	}

	async checkBase() {
		await checkDirectory(this[pathType], "data root path");
	}

	async read<R = string>(file: string, options: LocalStore.ReadOptions<R> = {}): Promise<R> {
		const originFile = file;
		file = resolvePath(this, file);
		const exists = await checkFileOrNotExists(file);

		// json option
		let { json = "auto" } = options;
		if (json === "auto") {
			json = /\.json/.test(originFile);
		}

		if (exists) {
			let data: string | R = (await readFile(file)).toString();
			if (json === "auto") {
				json = /\.json/.test(file);
			}
			if (json) {
				data = JSON.parse(data);
			}
			const { live } = options;
			if (typeof live === "function" && !live(originFile, data as R)) {
				await this.remove(file);
			} else {
				return data as R;
			}
		}

		const { builder } = options;
		if (typeof builder === "function") {
			let data: R | string = await asyncResult(builder());
			if (data == null) {
				data = json ? "{}" : "";
			}
			if (json && typeof data === "object") {
				data = JSON.stringify(data, null, 2);
			} else {
				data = String(data);
			}

			await checkFileDirectory(file);
			await writeFile(file, data);
			return json ? JSON.parse(data) : data;
		}

		throw createNotFoundError(file);
	}

	async require<R extends { [key: string]: any } = any>(
		file: string,
		options: LocalStore.RequireOptions<R> = {}
	): Promise<R> {
		file = resolvePath(this, file);
		const exists = await checkFileOrNotExists(file);
		const { builder, hash, clearCache = false } = options;

		const rebuild = async () => {
			if (typeof builder === "function") {
				const data = await asyncResult(builder());
				await checkFileDirectory(file);
				await writeFile(file, data);

				return require(file);
			}

			throw createNotFoundError(file);
		};

		if (exists) {
			if (clearCache) {
				delete require.cache[require.resolve(file)];
			}
			let update = false;
			let data: R;

			try {
				data = require(file);
			} catch (err) {
				if (typeof builder !== "function") {
					throw err;
				}
				return rebuild();
			}

			if (hash && Array.isArray(hash) && hash.length === 2) {
				const [key, value] = hash;
				if (data[key] !== value) {
					update = true;
					if (!clearCache) {
						delete require.cache[require.resolve(file)];
					}
				}
			}

			if (update) {
				if (typeof builder !== "function") {
					throw new Error("Builder option is not defined");
				}
			} else {
				return data;
			}
		}

		return rebuild();
	}

	async save(file: string, data: string): Promise<void> {
		file = resolvePath(this, file);
		await checkFileDirectory(file);
		await writeFile(file, data);
	}

	async saveJSON<D = any>(file: string, data: D): Promise<void> {
		return this.save(file, JSON.stringify(data, null, 2));
	}

	async clear(options: LocalStore.ListOptions = {}): Promise<number> {
		const stats: LocalStore.FStats[] = [];
		let history: string[] = [];
		await list(this, stats, history, options);

		let removed = 0;
		const errorFiles: LocalStore.FStats[] = [];

		for (let stat of stats) {
			try {
				await unlink(stat.fullPath);
				removed++;
			} catch (err) {
				errorFiles.push(stat);
			}
		}

		if (history.length > 0) {
			history = history.sort((a, b) => b.length - a.length);
			for (let dir of history) {
				let isEmpty = false;
				try {
					const dr = await opendir(dir);
					if (!(await dr.read())) {
						isEmpty = true;
					}
					await dr.close();
				} catch (err) {}

				if (isEmpty) {
					try {
						await rmdir(dir);
					} catch (err) {}
				}
			}
		}

		if (errorFiles.length > 0) {
			throw new StoreClearError(errorFiles, removed);
		}

		return removed;
	}

	async remove(file: string): Promise<boolean> {
		file = resolvePath(this, file);
		if (!(await checkExists(file))) {
			return false;
		}
		const stat = await lstat(file);
		if (stat.isFile()) {
			await unlink(file);
			return true;
		}
		return false;
	}

	async exists(file: string): Promise<boolean> {
		return checkExists(resolvePath(this, file));
	}

	async list(options: LocalStore.ListOptions = {}): Promise<LocalStore.FStats[]> {
		const stats: LocalStore.FStats[] = [];
		await list(this, stats, [], options);
		return stats;
	}

	resolve(...args: string[]): string {
		return resolvePath(this, args);
	}
}

export async function createLocalStore(path: string): Promise<LocalStoreData> {
	const store = new LocalStoreData(path);
	await store.checkBase();
	return store;
}
