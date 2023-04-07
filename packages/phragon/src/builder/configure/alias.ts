import type BuilderStore from "../BuilderStore";
import type { PhragonPlugin } from "../../types";
import { phragonRender } from "./phragon";
import { cwdPath, existsStat, mergeExtensions, readJsonFile, writeJsonFile } from "../../utils";
import { debug } from "../../debug";
import { newError } from "@phragon/cli-color";
import { join, extname, relative } from "node:path";
import { isList } from "./util";

type FindPath = { path: string; resolvePath: string; directory: boolean } | null;

function isExt(ext: string, extList: string[]) {
	return ext ? extList.includes(ext.toLowerCase()) : false;
}

function removeExt(path: string, extList: string[]) {
	const ext = extname(path);
	return isExt(ext, extList) ? path.slice(0, -ext.length) : path;
}

function createRelative(path: string) {
	return "./" + relative(process.cwd(), path).replace(/\\/g, "/");
}

async function findPath(plugin: PhragonPlugin.Plugin, path: string, extList: string[]): Promise<FindPath> {
	const full = join(plugin.cwd, path);
	const stat = await existsStat(full);

	// real path
	if (stat) {
		if (stat.isDirectory) {
			return {
				directory: true,
				path: createRelative(full),
				resolvePath: stat.file,
			};
		}
		return {
			directory: false,
			path: createRelative(removeExt(path, extList)),
			resolvePath: stat.file,
		};
	}

	// ext added (eq ./path.js)
	if (isExt(extname(path), extList)) {
		return null;
	}

	// find file
	for (const ext of extList) {
		const file = full + ext; // ./path -> ./path.js
		const stat = await existsStat(file);
		if (stat && stat.isFile) {
			return {
				directory: false,
				path: createRelative(full),
				resolvePath: stat.file,
			};
		}
	}

	return null;
}

async function updateTs(file: string, alias: FindAliasPath[]) {
	const data: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } } = await readJsonFile(file);
	if (!data.compilerOptions) {
		data.compilerOptions = {};
	}
	const saved = JSON.stringify([data.compilerOptions.baseUrl, data.compilerOptions.paths]);
	data.compilerOptions.baseUrl = "./";
	data.compilerOptions.paths = {};
	const paths = data.compilerOptions.paths;
	alias.forEach((item) => {
		const { name, directory, path } = item;
		const relativePath = path.substring(2);
		if (directory) {
			paths[`${name}/*`] = [`${relativePath}/*`];
			paths[name] = [`${relativePath}/index`];
		} else {
			paths[name] = [relativePath];
		}
	});
	if (saved !== JSON.stringify([data.compilerOptions.baseUrl, data.compilerOptions.paths])) {
		await writeJsonFile(file, data);
	}
}

export interface FindAliasPath {
	path: string;
	resolvePath: string;
	directory: boolean;
	name: string;
}

export default async function alias(store: BuilderStore, tsUpdate: boolean = true): Promise<FindAliasPath[]> {
	const list: PhragonPlugin.ConfigType<"name", string, { directory: string }>[] | undefined = store.store.alias;
	if (!isList(list)) {
		return [];
	}

	const alias: FindAliasPath[] = [];
	let extList = [".js", ".ts"];

	const render = await phragonRender(store);
	if (render) {
		extList = mergeExtensions(extList, render?.extensions?.all || []);
	}

	const dirs = ["./src-server/", "./src-client/", "./src-full/"];

	for (const item of list) {
		let { name, directory, __plugin } = item;
		const ext = __plugin.root ? extList : [".js"];
		directory = directory.replace(/\\/g, "/");
		if (directory.startsWith("/")) {
			directory = `./${directory}`;
		}
		if (!directory.startsWith("./")) {
			throw newError(
				"You cannot use the global module path for a directory alias. Use only local paths starting with ./..."
			);
		}
		let path = await findPath(__plugin, directory, ext);
		if (!path && !dirs.some((pref) => directory.startsWith(pref) || directory + "/" === pref)) {
			for (const dir of dirs) {
				path = await findPath(__plugin, dir + directory.substring(1), ext);
				if (path != null) {
					break;
				}
			}
		}
		if (!path) {
			debug("Alias directory {yellow %s} not found", directory);
		} else if (alias.some((a) => a.name === name)) {
			throw newError("Duplicate alias path {cyan %s}", name);
		} else {
			alias.push({ ...path, name });
		}
	}

	if (!tsUpdate || alias.length === 0) {
		return alias;
	}

	const tsconfigJson = cwdPath("./tsconfig.json");
	const stat = await existsStat(tsconfigJson);
	if (!stat) {
		debug.error("WARNING! {yellow %s} file not found", "./tsconfig.json");
	} else if (!stat.isFile) {
		debug.error("WARNING! {yellow %s} path must be a file", "./tsconfig.json");
	} else {
		await updateTs(tsconfigJson, alias);
	}

	return alias;
}
