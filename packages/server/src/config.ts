import type {ConfigHandler, EnvMode}  from "./types";
import {join} from "path";
import deepmerge from "deepmerge";
import {readdirSync, existsSync, statSync} from "fs";

const tree: {
	id?: string,
	mode: EnvMode,
	loaded: boolean,
	priority: string[],
	loaders: Record<string, <T>(file: string) => T>,
	path: Record<string, { loader: string, file: string }>,
} = {
	id: "",
	mode: process.env.NODE_ENV === "production" ? "production" : "development",
	loaded: false,
	priority: ["js", "json"],
	loaders: {
		js(file: string) {
			const data = require(file);
			return typeof data === "function" ? data() : data;
		},
		json(file: string) {
			return require(file);
		},
	},
	path: {}
};

function info(file: string, checkExists: boolean = false) {
	if(checkExists && !existsSync(file)) {
		return null;
	}
	return statSync(file);
}

function loadTreeNode(prefix: string, parent: string[]): void {
	let base = "config";
	if(prefix) {
		base += `/${prefix}`;
	}
	const fullPath = join(process.cwd(), base);
	const all = readdirSync(fullPath);
	for(let file of all) {
		// ignore hidden
		if(file.charAt(0) === ".") {
			continue;
		}

		// read only current cluster directory
		if(prefix === "" && file === "cluster") {
			if(!tree.id) {
				continue;
			}

			file = `cluster/${tree.id}`;
			const clusterPath = join(process.cwd(), file);
			const stat = info(clusterPath, true);
			if(!stat || !stat.isDirectory()) {
				continue;
			}

			parent.push(require.resolve(clusterPath));

			return loadTreeNode(file, parent);
		}

		const readPath = join(fullPath, file);
		const stat = info(readPath);
		if(!stat) {
			continue;
		}

		const resolvePath = require.resolve(readPath);
		if(stat.isDirectory()) {
			if(parent.includes(resolvePath)) {
				continue;
			}

			// prevent symbolic link recursive
			parent.push(resolvePath);
			return loadTreeNode(prefix ? `${prefix}/${file}` : file, parent);
		}

		const match = file.match(/^(.+?)\.([a-z]+)$/);
		if(!match) {
			continue;
		}

		const [, name, loader] = match;
		const priority = tree.priority.indexOf(loader);
		if(priority === -1) {
			continue;
		}

		const key = prefix ? `${prefix}/${name}` : name;
		if(!tree.path.hasOwnProperty(key) || priority < tree.priority.indexOf(tree.path[key].loader) ) {
			tree.path[key] = { loader, file: resolvePath };
		}
	}
}

export function loadTree(id?: string, mode?: EnvMode, loaders?: Record<string, <T>(file: string) => T>): void {
	if(!tree.loaded) {
		if(id != null) {
			tree.id = id;
		}

		if(mode && tree.mode !== mode) {
			tree.mode = mode === "production" ? "production" : "development";
		}

		// add loaders
		if(loaders != null && typeof loaders === "object") {
			const keys = Object.keys(loaders);
			for(let ix = 0; ix < keys.length; ix++) {
				const key = keys[ix];
				const loader = loaders[key];
				if(typeof loader !== "function") {
					continue;
				}

				// change index priority
				const index = tree.priority.indexOf(key);
				if(index === -1) {
					tree.priority.push(key);
				} else if(ix !== index) {
					tree.priority.splice(index, 1);
					tree.priority.splice(ix, 0, key);
				}

				// set new handler
				tree.loaders[key] = loader;
			}
		}

		// load tree
		loadTreeNode("", []);

		tree.loaded = true;
	}
}

function isMode<T>(data: any, mode: EnvMode): data is Record<EnvMode, T> {
	return data && data.hasOwnProperty(mode) && typeof data[mode] === "object" && data[mode] != null;
}

function get<T extends object = any>(name: string, def?: Partial<T>): T {
	const {path, mode, loaders} = tree;
	const info = path.hasOwnProperty(name) ? path[name] : null;
	if(!info) {
		return def as T;
	}
	let data = loaders[info.loader]<T>(info.file);
	if(isMode<T>(data, mode)) {
		data = data[mode];
	}
	if(def) {
		return deepmerge(def, data);
	}
	return data as T;
}

export const config: ConfigHandler = function config<T extends object = any>(name: string, def?: Partial<T>): T {
	if(!tree.loaded) {
		throw new Error("Config tree is not loaded");
	}

	if(name.startsWith("cluster/")) {
		throw new Error("Cluster access denied");
	}

	return ((tree.id
		? get(`cluster/${tree.id}/${name}`, get(name, def))
		: get(name, def)) || {}) as T;
}
