import {join, dirname} from "path";
import {existsStat, readJsonFile} from "../utils";
import {newError} from "@credo-js/cli-color";
import {getPackageModuleVersion, installDependencies, splitModule} from "../dependencies";
import {satisfies} from "semver";
import {isPlainObject} from "is-plain-object";
import type {EStat, CredoPlugin, CredoConfig} from "../types";

async function ready(plugins: CredoPlugin.Plugin[], sum: PluginSum, deps: string[] = [], loadDependencies: boolean = true) {

	const {name, root} = sum;
	const pluginPath = dirname(sum.credoJsonPath);
	const data = await readJsonFile(sum.credoJsonPath);

	const searchVariant = async (files: string[]) => {
		for(let file of files) {
			const stat = await existsStat(file);
			if(stat && stat.isFile) {
				return stat;
			}
		}
		return null;
	};

	const search = async (file: string, mode: "mixed" | "file" | "directory", typescript: boolean = false) => {

		file = String(file).trim();
		if(file.startsWith("/")) {
			file = `.${file}`;
		} else if(file.startsWith("~")) {
			file = file.substring(1);
			file = (file.startsWith("/") ? "./src-server" : "./src-server/") + file;
		}

		// search package (node_modules, global, etc.)
		if(!file.startsWith(".")) {
			try {
				file = require.resolve(file);
			} catch(err) {
				return null;
			}
			if(mode === "directory") {
				file = dirname(file);
			}
			return existsStat(file);
		}

		file = join(pluginPath, file);

		// search local
		let stat = await existsStat(file);
		if(stat) {

			if(mode === "directory") {
				return stat.isDirectory ? stat : null;
			}

			if(mode === "file" && stat.isFile) {
				return stat;
			}

			if(stat.isDirectory) {
				const files = [join(file, "/index.js")];
				if(typescript) {
					files.push(join(file, "/index.ts"));
				}
				const search = await searchVariant(files);
				if(search) {
					return search;
				}
				if(mode === "file") {
					return null;
				}
			} else if(mode === "file") {
				return stat.isFile ? stat : null;
			}

			return stat;
		}

		if(mode === "directory" || /\.(?:[tj]s|json)$/.test(file)) {
			return null;
		}

		const files = [`${file}.js`, `${file}.json`];
		if(typescript) {
			files.push(`${file}.ts`);
		}

		stat = await searchVariant(files);
		if(stat && mode === "file" && !stat.isFile) {
			return null;
		}

		return stat;
	};

	const def: CredoPlugin.Plugin = {
		... sum,
		pluginPath,

		root,
		hooks: {},
		dependencies: [],
		middleware: [],
		services: {},
		controllers: {},
		responders: {},
		extraMiddleware: {},
		cmd: {},

		joinPath(... args: string[]) {
			return join(pluginPath, ...args);
		},
		resolver(file: string | string[], mode: "mixed" | "file" | "directory" = "mixed"): Promise<EStat | null> {
			return search(join(pluginPath, ...file), mode, root);
		},
	};

	const importer = async (point: CredoConfig.Handler, options: {home: string, type?: string, name?: string, typescript?: boolean, withOptions?: boolean}): Promise<CredoPlugin.HandlerOptional> => {
		if(typeof point === "string") {
			point = {
				path: point,
			};
		}
		const {typescript = root, withOptions = true} = options;
		if(point.path.startsWith("~")) {
			const {home, type, name} = options;
			if(point.path === "~") {
				if(!name) {
					throw newError(`Short link {yellow ~} without filename is not supported for ${type}`);
				}
				point.path = home + name;
			} else {
				point.path = home + point.path.substring(1);
			}
		}
		const stat = await search(point.path, "file", typescript);
		if(!stat) {
			throw newError(`The "{yellow %s}" path not found in the "{yellow %s}" module directory`, point.path, name);
		}
		const result: CredoPlugin.HandlerOptional = {
			path: stat.file,
			importer: String(point.importer || "default"),
		};
		if(withOptions && isPlainObject(point.options)) {
			result.options = point.options;
		}
		return result;
	};

	let {
		dependencies = [],
		public: publicPath = null,
		lexicon: lexiconPath = null,
		config: configPath = null,
		middleware = [],
		services = {},
		responders = {},
		extraMiddleware = {},
		cmd = {},
		controllers = {},
		hooks = {},
		bootloader = null,
		bootstrap = null,
	} = data;

	deps.push(name);

	// load plugin dependencies

	if(loadDependencies) {
		for(const dependency of dependencies) {
			const dp = splitModule(dependency);

			// already added
			if(plugins.some((plugin => {
				if(plugin.name === dp.name) {
					checkPluginVersion(plugin.name, plugin.version, dp.version);
					return true;
				} else {
					return false;
				}
			}))) {
				continue;
			}

			// recursive dependencies
			if(deps.includes(dp.name)) {
				throw newError(`Recursive plugin dependency {cyan %s > %s}`, deps.join(" > "), dp.name);
			}

			await ready(plugins, await readStat(dp), deps);
		}
	}

	const index = deps.indexOf(name);
	if(index !== -1) {
		deps.splice(index, 1);
	}

	type PropType = "public" | "lexicon" | "config";

	const props: Record<PropType, string | true | null> = {
		"public": publicPath,
		lexicon: lexiconPath,
		config: configPath
	};

	for(let key of (Object.keys(props) as PropType[])) {
		let value: string | true | null = props[key];
		if(value) {
			const stat = await search(value === true ? `/${key}` : value, "directory");
			if(stat) {
				def[key] = stat.file;
			}
		}
	}

	// bootstrap, bootloader
	if(bootstrap) {
		def.bootstrap = await importer(bootstrap, {home: "./src-server/", name: "bootstrap"});
	}
	if(bootloader) {
		def.bootloader = await importer(bootloader, {home: "./src-client/", name: "bootloader"});
	}

	// middleware
	if(Array.isArray(middleware)) {
		for(let file of middleware) {
			def.middleware.push(await importer(file, {home: "./src-server/middleware/", type: "middleware"}));
		}
	}

	async function each(prop: Record<string, string>, entry: Record<string, CredoPlugin.HandlerOptional>, home: string) {
		for(let name of Object.keys(prop)) {
			entry[name] = await importer(prop[name], {home: `./src-server/${home}/`, name});
		}
	}

	// services, controllers, responders, extraMiddleware, cmd
	await each(services, def.services, "services");
	await each(controllers, def.controllers, "controllers");
	await each(responders, def.responders, "responders");
	await each(extraMiddleware, def.extraMiddleware, "extraMiddleware");
	await each(cmd, def.cmd, "cmd");

	// hooks
	const names: CredoPlugin.HooksEvent[] = ["onBuild", "onInstall", "onWebpackConfigure", "onRollupConfigure", "onOptions"];
	for(let name of names) {
		if(hooks[name]) {
			def.hooks[name] = await importer(hooks[name], {home: "./hooks/", name, typescript: false, withOptions: false});
		}
	}

	plugins.push(def);
}

type PluginSum = {
	name: string,
	version: string,
	credoJsonPath: string,
	root: boolean
}

async function load(sum: PluginSum) {
	const plugins: CredoPlugin.Plugin[] = [];
	await ready(plugins, sum);
	return plugins;
}

function checkPluginVersion(name: string, currentVersion: string, expectedVersion: string) {
	const valid = expectedVersion === "*" || expectedVersion === "latest" || satisfies(currentVersion, expectedVersion);
	if(!valid) {
		throw newError(`Installed version of module {cyan %s} does not match new dependencies {cyan %s}`, `${name}@${currentVersion}`, expectedVersion);
	}
}

async function pluginSum(name: string, version: string, credoJsonPath: string, root = false): Promise<PluginSum> {
	return {
		name,
		version,
		credoJsonPath,
		root
	};
}

async function readStat(dep: {name: string, version: string}) {
	const {name} = dep;

	let ver = await getPackageModuleVersion(name);
	if (ver) {
		checkPluginVersion(name, ver, dep.version);
	} else {
		// install dependency
		await installDependencies({[name]: dep.version});

		// reload
		ver = await getPackageModuleVersion(name);
		if (!ver) {
			throw newError("Can't detect {cyan %s} module version", name);
		}
	}

	let file: string;
	try {
		file = require.resolve(`${name}/credo.json`);
	} catch(err) {
		throw newError(`The {yellow %s} plugin file not found`, name);
	}

	return pluginSum(name, ver, file);
}

async function getRoot(): Promise<{ name: string, version: string } | null> {
	const stat = await existsStat("./package.json");
	if(!stat || !stat.isFile) {
		return null;
	}
	const json = await readJsonFile(stat.file);
	return {
		name: json.name,
		version: json.version || "1.0.0",
	};
}

export async function loadPlugin(module: string): Promise<CredoPlugin.Plugin[]> {

	const dep = splitModule(module);
	const root = await getRoot();
	if(!root) {
		return [];
	}

	// root plugin
	if(dep.name === root.name) {
		const stat = await existsStat("./credo.json");
		if(stat && stat.isFile) {
			return load(await pluginSum(root.name, root.version, stat.file, true));
		}
		return [];
	}

	// another plugin
	return load(await readStat(dep));
}

export async function loadRootPluginOnly(): Promise<CredoPlugin.Plugin> {
	const root = await getRoot();
	if(!root) {
		throw new Error("Root plugin is not defined");
	}

	const stat = await existsStat("./credo.json");
	if(!stat || !stat.isFile) {
		throw new Error("Root plugin is not defined");
	}

	const plugins: CredoPlugin.Plugin[] = [];
	await ready(plugins, await pluginSum(root.name, root.version, stat.file, true), [], false);
	return plugins[0];
}

export async function loadAllPlugins(): Promise<CredoPlugin.Plugin[]> {
	const rootName = await getRoot();
	if(!rootName) {
		return [];
	}
	return loadPlugin(rootName.name);
}