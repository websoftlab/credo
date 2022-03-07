import type {ConfigHandler}  from "./types";
import {join} from "path";
import {constants} from "fs";
import deepmerge from "deepmerge";
import {readdir, stat, access} from "fs/promises";

const tree: {
	cid?: string,
	loaded: boolean,
	priority: string[],
	loaders: Record<string, <T>(file: string) => T>,
	path: Record<string, { loader: string, file: string }>,
} = {
	cid: "",
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

async function info(file: string, checkExists: boolean = false) {
	if(checkExists) {
		try {
			await access(file, constants.F_OK);
		} catch(err) {
			return null;
		}
	}
	return await stat(file);
}

async function loadTreeNode(prefix: string, parent: string[]): Promise<void> {
	let base = "config";
	if(prefix) {
		base += `/${prefix}`;
	}
	const fullPath = join(process.cwd(), base);
	const all = await readdir(fullPath);
	for(let file of all) {
		// ignore hidden
		if(file.charAt(0) === ".") {
			continue;
		}

		// read only current cluster directory
		if(prefix === "" && file === "cluster") {
			if(!tree.cid) {
				continue;
			}

			file = `cluster/${tree.cid}`;
			const clusterPath = join(process.cwd(), file);
			const stat = await info(clusterPath, true);
			if(!stat || !stat.isDirectory()) {
				continue;
			}

			parent.push(require.resolve(clusterPath));

			return loadTreeNode(file, parent);
		}

		const readPath = join(fullPath, file);
		const stat = await info(readPath);
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

export async function loadTree(cid?: string, loaders?: Record<string, <T>(file: string) => T>) {
	if(!tree.loaded) {
		if(cid != null) {
			tree.cid = cid;
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
		await loadTreeNode("", []);

		tree.loaded = true;
	}
}

function get<T extends object = any>(name: string, def?: Partial<T>) {
	const {path, loaders} = tree;
	const info = path.hasOwnProperty(name) ? path[name] : null;
	if(!info) {
		return def;
	}
	const data = loaders[info.loader]<T>(info.file);
	if(def) {
		return deepmerge(data, def);
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

	return ((tree.cid
		? get(`cluster/${tree.cid}/${name}`, get(name, def))
		: get(name, def)) || {}) as T;
}
