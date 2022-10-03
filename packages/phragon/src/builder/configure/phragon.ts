import type BuilderStore from "../BuilderStore";
import type { EStat, PhragonConfig, PhragonPlugin } from "../../types";
import { readdir, stat } from "fs/promises";
import { newError } from "@phragon/cli-color";
import { asyncResult, isPlainObject } from "@phragon/utils";
import { dirname, join, extname } from "path";
import { copyTemplateIfEmpty, cwdSearchFile, existsStat } from "../../utils";
import { debug } from "../../debug";
import { installDependencies, splitModule } from "../../dependencies";
import { cpus } from "os";
import { DaemonSignKill } from "../../types";
import { isList } from "./util";

async function searchVariant(files: string[]) {
	for (let file of files) {
		const stat = await existsStat(file);
		if (stat && stat.isFile) {
			return stat;
		}
	}
	return null;
}

async function search(
	plugin: PhragonPlugin.Plugin,
	file: string,
	mode: "mixed" | "file" | "directory",
	typescript: boolean = false
) {
	file = String(file).trim();
	if (file.startsWith("/")) {
		file = `.${file}`;
	}

	// search package (node_modules, global, etc.)
	if (!file.startsWith(".")) {
		try {
			file = require.resolve(file);
		} catch (err) {
			return null;
		}
		if (mode === "directory") {
			file = dirname(file);
		}
		return existsStat(file);
	}

	file = plugin.joinPath(file);

	// search local
	let stat = await existsStat(file);
	if (stat) {
		if (mode === "directory") {
			return stat.isDirectory ? stat : null;
		}

		if (mode === "file" && stat.isFile) {
			return stat;
		}

		if (stat.isDirectory) {
			const files = [join(file, "/index.js")];
			if (typescript) {
				files.push(join(file, "/index.ts"));
			}
			const search = await searchVariant(files);
			if (search) {
				return search;
			}
			if (mode === "file") {
				return null;
			}
		} else if (mode === "file") {
			return stat.isFile ? stat : null;
		}

		return stat;
	}

	if (mode === "directory" || /\.(?:[tj]s)$/.test(file)) {
		return null;
	}

	const files = [`${file}.js`, `${file}.json`];
	if (typescript) {
		files.push(`${file}.ts`);
	}

	stat = await searchVariant(files);
	if (stat && mode === "file" && !stat.isFile) {
		return null;
	}

	return stat;
}

async function importer(
	plugin: PhragonPlugin.Plugin,
	point: PhragonConfig.Handler,
	options: { typescript?: boolean; withOptions?: boolean }
): Promise<PhragonPlugin.HandlerOptional> {
	if (typeof point === "string") {
		point = {
			path: point,
		};
	}
	const { path } = point;
	const { typescript = plugin.root, withOptions = true } = options;
	const stat = await search(plugin, path, "file", typescript);
	if (!stat) {
		throw newError(`The "{yellow %s}" path not found in the "{yellow %s}" module directory`, path, plugin.name);
	}
	const result: PhragonPlugin.HandlerOptional = {
		path: stat.file,
		importer: String(point.importer || "default"),
	};
	if (withOptions && isPlainObject(point.options)) {
		result.options = point.options;
	}
	return result;
}

async function eachHandler<Key extends string, Rest extends {} = {}>(
	type: Key,
	object?: PhragonPlugin.ConfigType<Key, PhragonConfig.Handler, Rest>[],
	withOptions = true
): Promise<PhragonPlugin.ConfigType<Key, PhragonPlugin.HandlerOptional, Rest>[]> {
	if (!isList(object)) {
		return [];
	}

	const list: PhragonPlugin.ConfigType<Key, PhragonPlugin.HandlerOptional, Rest>[] = [];
	if (!object.length) {
		return list;
	}

	for (const item of object) {
		list.push({
			...item,
			[type]: await importer(item.__plugin, item[type], { withOptions }),
		} as PhragonPlugin.ConfigType<Key, PhragonPlugin.HandlerOptional, Rest>);
	}

	return list;
}

async function _phragonClusterList(
	store: BuilderStore,
	render: PhragonPlugin.RenderDriver | null,
	plugin: PhragonPlugin.Plugin | null,
	options: any,
	ssr: boolean
): Promise<PhragonPlugin.ClusterOptions[]> {
	function validName(name: string) {
		return name.length > 0 && name.length <= 50 && /^[a-zA-Z][\w\-]*$/.test(name);
	}

	const clusterList: PhragonPlugin.ClusterOptions[] = [];
	const list: PhragonPlugin.ConfigType<"id", string, Omit<PhragonConfig.Cluster, "id">>[] =
		store.store.phragon["cluster"];

	if (!isList(list)) {
		return clusterList;
	}

	const ids: string[] = [];
	let isCron = false;
	let clsCount = 0;

	for (let cluster of list) {
		const id = String(cluster.id || "").trim();
		if (!id) {
			throw new Error("Empty cluster name");
		}
		if (!validName(id)) {
			throw newError(`Invalid cluster name {yellow %s}`, id);
		}
		if (ids.includes(id)) {
			throw newError(`Duplicate cluster name {yellow %s}`, id);
		}

		let {
			mode = "app",
			count = 1,
			render: renderOpt = false,
			renderOptions,
			ssr: ssrOpt,
			publicPath,
			env = {},
			__plugin,
		} = cluster;

		if (count < 1) {
			count = 1;
		}

		if (mode !== "app" && mode !== "cron") {
			throw newError(`Invalid cluster mode {yellow %s}`, mode);
		}

		if (mode === "cron") {
			if (isCron) {
				throw newError(`{green cron} mode can only be set once`);
			}
			isCron = true;
			renderOpt = false;
			if (count > 1) {
				count = 1;
			}
		} else if (renderOpt) {
			if (!render) {
				throw newError(
					`Render driver not defined, you can't set "render = true" option for the {cyan %s} cluster`,
					id
				);
			}
			if (!__plugin.root && (!plugin || plugin.name !== __plugin.name)) {
				debug("Cluster {cyan %s} ignored, rendering plugin uses another plugin");
				continue;
			}
		}

		const pco: PhragonPlugin.ClusterOptions = {
			id,
			mid: ids.length + 1,
			mode,
			count,
			render: false,
			ssr: false,
			env: env || {},
			renderOptions: {},
		};

		if (publicPath) {
			const path = await getPublicPath(__plugin, publicPath);
			if (path) {
				pco.publicPath = path;
			}
		}

		if (renderOpt && render) {
			pco.render = true;
			pco.ssr = typeof ssrOpt === "boolean" ? ssrOpt : ssr;
			pco.page = (await _phragonRenderPage(render, __plugin, pco.ssr, id)).render;
			pco.components = (await _phragonComponents(render, __plugin, id)).components;

			if (isPlainObject(renderOptions)) {
				pco.renderOptions = renderOptions;
			} else {
				pco.renderOptions = options;
			}

			const bootloader = await phragonImport(__plugin, "bootloader", id);
			if (bootloader) {
				pco.bootloader = bootloader.bootloader;
			}
		}

		const bootstrap = await phragonImport(__plugin, "bootstrap", id);
		if (bootstrap) {
			pco.bootstrap = bootstrap.bootstrap;
		}

		clsCount += pco.count;
		ids.push(id);
		clusterList.push(pco);
	}

	const cpuCount = cpus().length;
	if (cpuCount < clsCount) {
		debug(`{red WARNING!} CPU core count < cluster workers count, {yellow ${cpuCount}} < {red ${clsCount}}`);
	}

	return clusterList;
}

export async function phragonCluster(store: BuilderStore): Promise<PhragonPlugin.ClusterOptions[]> {
	const { ssr, renderDriver, renderOptions, renderPlugin } = await _renderDriver(store);
	return await _phragonClusterList(store, renderDriver, renderPlugin, renderOptions, ssr);
}

export async function phragonLexicon(store: BuilderStore): Promise<PhragonPlugin.LexiconOptions> {
	let ie: string[] = [];

	const initialization: Record<string, boolean | undefined> = {};
	const lexicon: PhragonPlugin.LexiconOptions = {
		language: "en",
		languages: [],
		multilingual: false,
	};

	function init(key: string, write: boolean = true) {
		if (initialization[key] === true) {
			return true;
		}
		if (write) {
			initialization[key] = true;
		}
		return false;
	}

	function incExc(variant: "include" | "exclude", item: string | { name: string; type?: "lambda" | "data" | "all" }) {
		if (typeof item === "string") {
			item = { name: item, type: "all" };
		} else if (typeof item !== "object" || item == null) {
			throw newError(`{green ./phragon.config.ts} lexicon.${variant} invalid plugin value ${item}`);
		}
		let { name, type = "all" } = item;
		name = String(name || "").trim();
		if (ie.includes(name) || !store.pluginNameList.includes(name)) {
			return;
		}

		if (!type) {
			type = "all";
		} else if (!["lambda", "data", "all"].includes(type)) {
			throw newError(`{green ./phragon.config.ts} lexicon.${type} invalid plugin type ${type}`);
		}

		ie.push(name);
		const lst = lexicon[variant];
		const plugin = { name, type };

		if (lst) {
			lst.push(plugin);
		} else {
			lexicon[variant] = [plugin];
		}
	}

	function validName(name: string, max: number) {
		return !/[^\w.\-]/.test(name) && name.length > 0 && name.length <= max;
	}

	function variant(opts: PhragonConfig.Lexicon) {
		if (opts.languages) {
			if (!Array.isArray(opts.languages)) {
				throw newError(`{green ./phragon.config.ts} lexicon.{yellow languages} options is not defined`);
			}

			opts.languages.forEach((language: string) => {
				language = String(language || "").trim();
				if (!validName(language, 25)) {
					throw newError(`Invalid language id {yellow %s}`, language);
				}
				if (!lexicon.languages.includes(language)) {
					lexicon.languages.push(language);
				}
			});
		}

		const len = lexicon.languages.length;
		if (len > 0) {
			if (typeof opts.multilingual === "boolean") {
				lexicon.multilingual = opts.multilingual;
				init("multilingual");
			} else if (len > 1 && !init("multilingual")) {
				lexicon.multilingual = true;
			}
		}

		if (typeof opts.language === "string") {
			const language = opts.language.trim();
			if (!validName(language, 25)) {
				throw newError(`Invalid language id {yellow %s}`, language);
			}
			lexicon.language = language;
			init("language");
			if (!lexicon.languages.includes(language)) {
				lexicon.languages.unshift(opts.language);
			}
		} else if (len > 0 && !init("language")) {
			lexicon.language = lexicon.languages[0];
		}

		const inc = opts.include;
		const exc = opts.exclude;

		if (isList(inc)) {
			if (isList(exc)) {
				throw newError(
					`You cannot use options lexicon.{yellow include} and lexicon.{yellow exclude} at the same time`
				);
			}
			inc.forEach((item) => incExc("include", item));
		} else if (isList(exc)) {
			exc.forEach((item) => incExc("exclude", item));
		}

		if (isList(opts.packages)) {
			const packages: string[] = [];
			opts.packages.forEach((name: any) => {
				name = String(name === 0 ? "0" : name || "");
				if (name && validName(name, 25)) {
					packages.includes(name) || packages.push(name);
				} else {
					throw newError(`Invalid lexicon package name {yellow ${name}}`);
				}
			});
			lexicon.packages = packages;
		}

		if (opts.route) {
			let { method, path, service } = opts.route;
			method = String(method || "GET")
				.trim()
				.toUpperCase();
			if (!["GET", "POST"].includes(method)) {
				throw newError(`Invalid lexicon.method: {yellow %s}, only GET and POST methods are allowed`, method);
			}
			path = String(path || "").trim();
			service = String(service || "").trim();
			if (path && service) {
				if (lexicon.route && !init("route-warning")) {
					debug("Duplicate {yellow lexicon.route} configuration, the first routes will be ignored...");
				}
				lexicon.route = {
					method,
					path,
					service,
				};
			} else {
				throw newError(`Invalid lexicon.route: {yellow path} or {yellow service} is empty`);
			}
		}
	}

	const list: PhragonPlugin.ConfigType<"language", string, Omit<PhragonConfig.Lexicon, "language">>[] =
		store.store.phragon["lexicon"];

	if (isList(list)) {
		for (const item of list) {
			const { __plugin, ...rest } = item;
			if (__plugin.root) {
				variant(rest);
			} else {
				const { include, exclude, ...rest2 } = rest;
				variant(rest2);
			}
		}
	} else {
		let file = await cwdSearchFile("config/lexicon", [".js", ".json"]);
		if (file) {
			file = require.resolve(file);
			delete require.cache[require.resolve(file)];
			const data = require(file);
			if (data) {
				variant(data);
			}
		} else {
			debug("Language/lexicon configuration not found");
		}
	}

	if (lexicon.languages.length === 0) {
		debug("Language/lexicon configuration not found or not loaded or empty");
		lexicon.languages.push(lexicon.language);
	} else if (!init("language")) {
		lexicon.language = lexicon.language[0];
	}

	return lexicon;
}

async function getPublicPath(plugin: PhragonPlugin.Plugin, path: string) {
	const sync = await existsStat(join(plugin.cwd, path));
	if (!sync) {
		debug("The {yellow %s} path not found in the {cyan %s} plugin", path, plugin.name);
	} else if (!sync.isDirectory) {
		debug("The {yellow %s} path is not directory in the {cyan %s} plugin", path, plugin.name);
	} else {
		return sync.file;
	}
	return null;
}

export async function phragonPublic(
	store: BuilderStore
): Promise<PhragonPlugin.ConfigType<"path", string, { relativePath: string }>[]> {
	const result: { path: string; relativePath: string; __plugin: PhragonPlugin.Plugin }[] = [];
	const list: PhragonPlugin.ConfigType<"path", string>[] = store.store.phragon["publicPath"];
	if (!isList(list)) {
		return result;
	}

	for (const item of list) {
		const path = await getPublicPath(item.__plugin, item.path);
		if (path && result.every((it) => it.path !== path)) {
			result.push({
				path,
				relativePath: item.path,
				__plugin: item.__plugin,
			});
		}
	}

	return result;
}

const baseDriver: string[] = ["react"];

function isEs<Type>(obj: any): obj is { default: Type } {
	return obj && obj.__esModule && obj.default != null;
}

export async function phragonRender(
	store: BuilderStore
): Promise<(PhragonPlugin.RenderDriver & { ssr: boolean; renderOptions: any }) | null> {
	const pref = "@phragon/render-driver-";
	const list: PhragonPlugin.ConfigType<"driver", string, { ssr: boolean; renderOptions: any }>[] =
		store.store.phragon["render"];
	if (!isList(list)) {
		return null;
	}

	let render: { name: string; version: string; ssr: boolean; renderOptions: any } | null = null;

	for (const item of list) {
		let { ssr, driver, renderOptions = {} } = item;
		let { name, version } = splitModule(driver);
		ssr = Boolean(ssr);
		if (name.startsWith(pref)) {
			name = name.substring(pref.length);
		}
		if (render) {
			if (render.name !== name) {
				throw newError(`More than 2 drivers listed for page render`);
			} else {
				render.ssr = ssr;
				render.version = version;
				render.renderOptions = renderOptions;
			}
		} else {
			render = {
				name,
				ssr,
				version,
				renderOptions,
			};
		}
	}

	if (!render) {
		return null;
	}

	let driver: PhragonPlugin.RenderDriver | (() => PhragonPlugin.RenderDriver);
	let { name, version, ssr, renderOptions } = render;
	const originDriverName = name;

	// system drivers
	if (baseDriver.includes(name)) {
		name = `${pref}${name}`;
	}

	debug("Check render driver dependency {yellow %s}", originDriverName);
	await installDependencies({ [name]: version });

	try {
		driver = await import(`${name}/builder`);
	} catch (err) {
		throw newError(`The {yellow %s} HTML Render driver not found (import error)`, originDriverName);
	}

	if (isEs<PhragonPlugin.RenderDriver>(driver)) {
		driver = driver.default;
	}

	if (typeof driver === "function") {
		driver = await asyncResult(driver());
	}

	if (!isPlainObject(driver)) {
		throw newError(`Invalid builder for the {yellow %s} HTML Render driver`, name);
	}

	if (!driver.modulePath) {
		driver.modulePath = name;
	}

	return {
		...driver,
		ssr,
		renderOptions,
	};
}

export function phragonBuildTimeout(store: BuilderStore): string | null {
	const list: { value: string | number }[] = store.store.phragon["buildTimeout"];
	if (!isList(list)) {
		return null;
	}
	let timeout: string | null = null;
	for (const item of list) {
		let { value } = item;
		if (typeof value === "string") {
			value = value.trim();
			if (value.length === 0 || value === "0") {
				timeout = null;
			}
		} else {
			timeout = value <= 0 ? null : String(value);
		}
	}
	return timeout;
}

// prettier-ignore
const signals: string[] = [
	"SIGABRT", "SIGALRM", "SIGBUS",  "SIGCHLD", "SIGCONT", "SIGFPE",  "SIGHUP",  "SIGILL",    "SIGINT",
	"SIGKILL", "SIGPIPE", "SIGPOLL", "SIGPROF", "SIGQUIT", "SIGSEGV", "SIGSTOP", "SIGSYS",    "SIGTERM",
	"SIGTRAP", "SIGTSTP", "SIGTTIN", "SIGTTOU", "SIGUSR1", "SIGUSR2", "SIGURG",  "SIGVTALRM", "SIGXCPU",
	"SIGXFSZ", "SIGWINCH",
];

function isDaemonSignal(signal?: string): signal is DaemonSignKill {
	return typeof signal === "string" && signals.includes(signal);
}

function toInt(value: any): number | undefined {
	if (typeof value === "string") {
		value = parseInt(value);
	}
	if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
		return value;
	}
	return undefined;
}

export function phragonDaemon(store: BuilderStore): PhragonPlugin.DaemonOptions | null {
	const list: PhragonPlugin.DaemonOptions[] = store.store.phragon["daemon"];
	if (!isList(list)) {
		return null;
	}
	const daemon: PhragonPlugin.DaemonOptions = {};
	for (const item of list) {
		let { delay, cpuPoint, killSignal, pid } = item;

		delay = toInt(delay);
		cpuPoint = toInt(cpuPoint);

		if (typeof killSignal === "string") {
			const signal = killSignal.trim().toUpperCase();
			if (isDaemonSignal(signal)) {
				daemon.killSignal = signal;
			}
		}

		if (delay != null) {
			const min = 3 * 1000;
			const max = 5 * 60 * 1000;
			daemon.delay = delay < min ? min : delay > max ? max : delay;
		}
		if (cpuPoint != null) {
			const min = 10;
			const max = 2000;
			daemon.cpuPoint = cpuPoint < min ? min : cpuPoint > max ? max : cpuPoint;
		}
		if (typeof pid === "string" && pid.length) {
			daemon.pid = pid;
		}
	}
	return daemon;
}

function getExtList(render: PhragonPlugin.RenderDriver, plugin: PhragonPlugin.Plugin) {
	const extList = [".js"];
	if (plugin.root) {
		const all = render.extensions?.all || [];
		all.forEach((ext) => {
			if (!extList.includes(ext)) {
				extList.push(ext);
			}
		});
	}
	return extList;
}

async function _phragonRenderPage(
	render: PhragonPlugin.RenderDriver,
	plugin: PhragonPlugin.Plugin,
	ssr: boolean,
	cid?: string
): Promise<PhragonPlugin.ConfigType<"render", PhragonPlugin.RenderPage>> {
	// copy default template
	await copyTemplateIfEmpty(render);

	const extList = getExtList(render, plugin);
	let found: EStat | null = null;
	if (cid) {
		found = await searchVariant(extList.map((ext) => plugin.joinPath(`./src-client/${cid}/index${ext}`)));
	}
	if (!found) {
		found = await searchVariant(extList.map((ext) => plugin.joinPath(`./src-client/index${ext}`)));
	}
	if (found) {
		return {
			__plugin: plugin,
			render: {
				path: found.file,
				ssr,
			},
		};
	}
	if (plugin.root) {
		throw newError("Render index file not found");
	} else {
		throw newError("Render index file not found in the {yellow %s} plugin", plugin.name);
	}
}

async function _phragonComponents(
	render: PhragonPlugin.RenderDriver,
	plugin: PhragonPlugin.Plugin,
	cid?: string
): Promise<PhragonPlugin.ConfigType<"components", Record<string, PhragonPlugin.Handler>>> {
	let file = plugin.joinPath("./src-client");
	const st = await existsStat(file);
	if (!st || !st.isDirectory) {
		return {
			__plugin: plugin,
			components: {},
		};
	}

	if (cid) {
		const st = await existsStat(plugin.joinPath(`./src-client/${cid}`));
		if (st && st.isDirectory) {
			file = st.file;
		}
	}

	const found: { name: string; file: string }[] = [];
	const list = await readdir(file);
	for (const prefix of list) {
		if (!prefix.startsWith("_") || prefix.length === 1) {
			continue;
		}
		let name = prefix.substring(1);
		const full = join(file, prefix);
		const st = await stat(full);
		if (st.isFile()) {
			name = name.replace(/\.[a-z]+$/i, "");
		}
		found.push({ name, file: full });
	}

	if (!found.length) {
		return {
			__plugin: plugin,
			components: {},
		};
	}

	const extList = getExtList(render, plugin);
	const components: Record<string, PhragonPlugin.Handler> = {};
	for (const item of found) {
		const { name, file } = item;
		let st = await existsStat(file);
		if (!st) {
			continue;
		}
		if (st.isFile) {
			const ext = extname(st.file).toLowerCase();
			if (extList.includes(ext)) {
				components[name] = {
					path: st.file,
					importer: "default",
				};
			}
			continue;
		}
		if (!st.isDirectory) {
			continue;
		}
		st = await searchVariant(extList.map((ext) => join(file, "index" + ext)));
		if (st) {
			components[name] = {
				path: st.file,
				importer: "default",
			};
		}
	}

	return {
		__plugin: plugin,
		components,
	};
}

async function phragonImport<Key extends string>(
	plugin: PhragonPlugin.Plugin,
	key: Key,
	cid?: string
): Promise<PhragonPlugin.ConfigType<Key, PhragonPlugin.Handler> | null> {
	const prefix = plugin.root ? (key === "bootstrap" ? "./src-server/" : "./src-client/") : "./";

	let find: EStat | null = null;
	if (cid) {
		find = await search(plugin, prefix.concat(cid, "/", key), "file", plugin.root);
	}
	if (!find) {
		find = await search(plugin, prefix.concat(key), "file", plugin.root);
	}

	if (find) {
		return {
			__plugin: plugin,
			[key]: {
				path: find.file,
				importer: "default",
			},
		} as PhragonPlugin.ConfigType<Key, PhragonPlugin.Handler>;
	}

	return null;
}

async function phragonImportList<Key extends string>(
	store: BuilderStore,
	key: Key
): Promise<PhragonPlugin.ConfigType<Key, PhragonPlugin.Handler>[]> {
	const list: PhragonPlugin.ConfigType<Key, PhragonPlugin.Handler>[] = [];
	let root: PhragonPlugin.ConfigType<Key, PhragonPlugin.Handler> | null = null;
	for (const plugin of store.pluginList) {
		const item = await phragonImport(plugin, key);
		if (item) {
			if (plugin.root) {
				root = item;
			} else {
				list.push(item);
			}
		}
	}
	if (root) {
		list.push(root);
	}
	return list;
}

export async function phragonRenderPage(store: BuilderStore) {
	const { ssr, renderDriver, renderPlugin } = await _renderDriver(store);
	return renderDriver && renderPlugin ? _phragonRenderPage(renderDriver, renderPlugin, ssr) : null;
}

export async function phragonComponents(store: BuilderStore) {
	const { root, renderDriver, renderPlugin } = await _renderDriver(store);
	return renderDriver ? await _phragonComponents(renderDriver, renderPlugin || root) : {};
}

export async function phragonBootstrap(store: BuilderStore) {
	return phragonImportList(store, "bootstrap");
}

export async function phragonBootloader(store: BuilderStore) {
	return phragonImportList(store, "bootloader");
}

export async function phragonConfigLoader(store: BuilderStore) {
	return eachHandler<"loader", { type: string }>("loader", store.store.phragon["configLoader"]);
}

export async function phragonCmd(store: BuilderStore) {
	return eachHandler<"cmd", { name: string }>("cmd", store.store.phragon["cmd"]);
}

export async function phragonMiddleware(store: BuilderStore) {
	return eachHandler<"middleware">("middleware", store.store.phragon["middleware"]);
}

export async function phragonExtraMiddleware(store: BuilderStore) {
	return eachHandler<"middleware", { name: string }>("middleware", store.store.phragon["extraMiddleware"]);
}

export async function phragonResponder(store: BuilderStore) {
	return eachHandler<"responder", { name: string }>("responder", store.store.phragon["responder"]);
}

export async function phragonController(store: BuilderStore) {
	return eachHandler<"controller", { name: string }>("controller", store.store.phragon["controller"]);
}

export async function phragonService(store: BuilderStore) {
	return eachHandler<"service", { name: string }>("service", store.store.phragon["service"]);
}

async function _renderDriver(store: BuilderStore) {
	const render = await phragonRender(store);
	const root = store.pluginList.find((p) => p.root);

	if (!root) {
		throw new Error("Root plugin is not loaded");
	}

	if (!render) {
		return {
			root,
			renderDriver: null,
			renderPlugin: null,
			ssr: false,
			renderOptions: {},
		};
	}

	const { ssr, renderOptions, ...rest } = render;
	const list: PhragonPlugin.ConfigType<"renderable", boolean>[] = store.store.phragon["renderable"] || [];

	let rRoot = true;
	let rIgnore = false;
	let renderPlugin: PhragonPlugin.Plugin | null = null;

	for (const item of list) {
		const { renderable, __plugin } = item;
		if (__plugin.root) {
			rRoot = renderable;
		} else if (renderable) {
			if (renderPlugin && renderPlugin.name !== __plugin.name && !rIgnore) {
				debug(`More than 2 plugin listed for page render, the first renderable will be ignored...`);
				rIgnore = true;
			}
			renderPlugin = __plugin;
		} else if (renderPlugin && renderPlugin.name === __plugin.name) {
			renderPlugin = null;
		}
	}

	if (renderPlugin) {
		if (rRoot) {
			debug(
				`Some plugins may use render mode, if you want to disable rendering by default, add the renderable(false) option to the {yellow %s} config file.`,
				"./phragon.config.ts"
			);
		} else {
			renderPlugin = root;
		}
	} else {
		renderPlugin = root;
	}

	return {
		root,
		renderDriver: rest as PhragonPlugin.RenderDriver,
		renderPlugin,
		ssr,
		renderOptions,
	};
}

export async function phragon(store: BuilderStore) {
	const { root, ssr, renderDriver, renderOptions, renderPlugin } = await _renderDriver(store);
	return {
		cluster: await _phragonClusterList(store, renderDriver, renderPlugin, renderOptions, ssr),
		cmd: await phragonCmd(store),
		controller: await phragonController(store),
		extraMiddleware: await phragonExtraMiddleware(store),
		lexicon: await phragonLexicon(store),
		middleware: await phragonMiddleware(store),
		configLoader: await phragonConfigLoader(store),
		publicPath: await phragonPublic(store),
		render: renderDriver,
		renderOptions,
		renderPlugin,
		ssr,
		page: renderDriver && renderPlugin ? await _phragonRenderPage(renderDriver, renderPlugin, ssr) : null,
		responder: await phragonResponder(store),
		service: await phragonService(store),
		buildTimeout: phragonBuildTimeout(store),
		daemon: phragonDaemon(store),
		bootstrap: await phragonBootstrap(store),
		bootloader: await phragonBootloader(store),
		components: (renderDriver
			? await _phragonComponents(renderDriver, renderPlugin || root)
			: {}) as PhragonPlugin.ConfigType<"components", Record<string, PhragonPlugin.Handler>>,
	};
}
