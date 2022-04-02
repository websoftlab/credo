import type {DaemonSignKill, CredoConfig, CredoPlugin} from "../types";
import {newError} from "@credo-js/cli-color";
import {asyncResult} from "@credo-js/utils";
import {cwdPath, cwdSearchFile, existsStat, readJsonFile, resolveFile} from "../utils";
import {createLexiconOptions} from "./build";
import {cpus} from "os";
import {debugError, debugBuild} from "../debug";
import {splitModule, installDependencies} from "../dependencies";
import {isPlainObject} from "is-plain-object";

type CType = "publicPath" | "bootstrap" | "bootloader";

const signals: string[] = [
	"SIGABRT", "SIGALRM", "SIGBUS",  "SIGCHLD", "SIGCONT", "SIGFPE",  "SIGHUP",  "SIGILL",    "SIGINT",
	"SIGKILL", "SIGPIPE", "SIGPOLL", "SIGPROF", "SIGQUIT", "SIGSEGV", "SIGSTOP", "SIGSYS",    "SIGTERM",
	"SIGTRAP", "SIGTSTP", "SIGTTIN", "SIGTTOU", "SIGUSR1", "SIGUSR2", "SIGURG",  "SIGVTALRM", "SIGXCPU",
	"SIGXFSZ", "SIGWINCH",
];

function isDaemonSignal(signal?: string): signal is DaemonSignKill {
	return typeof signal === "string" && signals.includes(signal);
}

function normalize(file: string) {
	if(file.startsWith("./")) {
		file = file.substring(2);
	} else if(file.startsWith("/")) {
		file = file.substring(1);
	}
	return `./pages/${file}`;
}

async function search(file: string, extensions: string[]) {
	const match = file.match(/(\.[^.]+)$/);

	if(match && extensions.includes(match[0])) {
		const stat = await existsStat(file);
		return stat && stat.isFile ? stat.file : null;
	} else {
		return (
			await cwdSearchFile(`${file}/index`, extensions)
		) || (
			await cwdSearchFile(`${file}`, extensions)
		);
	}
}

const baseDriver: string[] = [
	"react"
];

function isEs<Type>(obj: any): obj is {default: Type} {
	return obj && obj.__esModule && obj.default != null;
}

async function loadDriver(renderDriver: string): Promise<CredoPlugin.RenderDriver> {

	let driver: CredoPlugin.RenderDriver | (() => CredoPlugin.RenderDriver);
	const {name, version} = splitModule(renderDriver);
	const originDriverName = renderDriver;

	renderDriver = name;

	// system drivers
	if(baseDriver.includes(renderDriver)) {
		renderDriver = `@credo-js/render-driver-${renderDriver}`;
	}

	debugBuild("Check render driver dependency {yellow %s}", originDriverName);
	await installDependencies({[renderDriver]: version});

	try {
		driver = await import(`${renderDriver}/builder`);
	} catch(err) {
		throw newError(`The {yellow %s} HTML Render driver not found (import error)`, originDriverName);
	}

	if(isEs<CredoPlugin.RenderDriver>(driver)) {
		driver = driver.default;
	}

	if(typeof driver === "function") {
		driver = await asyncResult(driver());
	}

	if(driver == null || typeof driver !== "object") {
		throw newError(`Invalid builder for the {yellow %s} HTML Render driver`, renderDriver);
	}

	if(!driver.modulePath) {
		driver.modulePath = renderDriver;
	}

	return driver;
}

export default async function loadRootOptions(plugins: CredoPlugin.Plugin[]): Promise<CredoPlugin.RootOptions> {

	const root = plugins.find(plugin => plugin.root);
	if(!root) {
		throw new Error("Root plugin is not loaded");
	}

	async function importer(point: CredoConfig.Handler, withOptions: boolean = true): Promise<CredoPlugin.HandlerOptional> {
		if(typeof point === "string") {
			point = {
				path: point,
			};
		}

		const path = await resolveFile(point.path);
		if(!path) {
			throw newError(`The {yellow %s} path not found`, point.path);
		}

		const result: CredoPlugin.HandlerOptional = {
			path,
			importer: String(point.importer || "default"),
		};

		if(withOptions && isPlainObject(point.options)) {
			result.options = point.options;
		}

		return result;
	}

	const data = await readJsonFile(root.credoJsonPath);
	const opts = data.options || {};
	const names = plugins.map(plugin => plugin.name);
	const options: CredoPlugin.RootOptions = {
		ssr: opts.ssr !== false,
		pages: false,
		lexicon: await createLexiconOptions(opts.lexicon, names),
	};

	const renderDriver: string | undefined = opts.renderDriver;
	if(renderDriver) {
		options.renderDriver = await loadDriver(renderDriver);
	} else {
		options.ssr = false;
	}

	async function getPages(file: string | null | false | undefined): Promise<string | false | undefined> {
		const {renderDriver} = options;
		if(!renderDriver) {
			return undefined;
		}
		if(file === false) {
			return false;
		}
		const origin = file;
		if(!file) {
			file = "./pages/index";
		} else {
			file = normalize(file);
		}

		file = await search(file, renderDriver.extensions?.all || [".js", ".ts"]);
		if(!file) {
			throw newError("Index {cyan %s} file not found", origin || "./pages/index");
		}

		return file;
	}

	async function getComponents(components: Record<string, string>): Promise<undefined | Record<string, string>> {
		if(!components || !options.renderDriver) {
			return undefined;
		}
		const {renderDriver} = options;
		for(let name of Object.keys(components)) {
			const file: string | null = await search(normalize(components[name]), renderDriver.extensions?.all || [".js", ".ts"]);
			if(!file) {
				throw newError("The {yellow %s} > {cyan %s} component not found", name, components[name]);
			}
			components[name] = file;
		}
		return components;
	}

	const cls: CredoPlugin.RootClusterOptions[] = [];
	let clsCount: number = 0;
	let {components, pages, clusters, configLoaders, daemon, onBuildTimeout} = opts;
	let rootPages: string | undefined;
	let rootComponents: Record<string, string> | undefined;

	if(options.renderDriver) {

		// pages
		pages = await getPages(pages);
		if(pages != null) {
			rootPages = pages;
		}

		// components
		if(components) {
			components = await getComponents(components);
			if(components) {
				rootComponents = components;
			}
		} else {
			rootComponents = {};
			for(let name of ["error", "layout", "spinner"]) {
				const file = (
					await cwdSearchFile(`pages/_${name}/index`, options.renderDriver.extensions?.all)
				) || (
					await cwdSearchFile(`pages/_${name}`, options.renderDriver.extensions?.all)
				);
				if(file) {
					rootComponents[name] = file;
				}
			}
		}
	}

	if(Array.isArray(clusters) && clusters.length > 0) {
		const ids: string[] = [];
		let isCron = false;

		for(let cluster of clusters) {
			if(typeof cluster === "string") {
				cluster = {id: cluster};
			}
			const id = String(cluster.id || "").trim();
			if(!id) {
				throw new Error("Empty cluster name");
			}
			if(ids.includes(id)) {
				throw newError(`Duplicate cluster name {yellow %s}`, id);
			}

			let {
				mode = "app",
				count = 1,
				pages,
				components,
				public: publicPath,
				bootstrap,
				ssr,
				env = {},
				bootloader
			} = cluster;

			if(count < 1) {
				count = 1;
			}

			if(mode !== "app" && mode !== "cron") {
				throw newError(`Invalid cluster mode {yellow %s}`, mode);
			}

			if(mode === "cron") {
				if(isCron) {
					throw newError(`{green cron} mode can only be set once`);
				}
				isCron = true;
				if(count > 1) {
					count = 1;
				}
			}

			const pco: CredoPlugin.RootClusterOptions = {
				id,
				pages: false,
				mid: ids.length + 1,
				mode,
				count,
				ssr: isCron ? false : (typeof ssr === "boolean" ? ssr : options.ssr),
				env: env || {},
			};

			const oj: Record<CType, string> = {publicPath, bootstrap, bootloader};
			for(let key in oj) {
				const value = oj[key as CType];
				if(value) {
					if(key === "publicPath") {
						const dir = await existsStat(cwdPath(value));
						if(dir && dir.isDirectory) {
							pco.publicPath = dir.file;
						}
					} else {
						pco[key as ("bootstrap" | "bootloader")] = await importer(value);
					}
				}
			}

			if(mode === "app" && options.renderDriver) {

				pages = await getPages(pages);
				if(pages != null) {
					pco.pages = pages;
				} else if(rootPages) {
					pco.pages = rootPages;
				}

				if(components) {
					components = await getComponents(components);
					if(components) {
						pco.components = components;
					}
				} else if(rootComponents) {
					pco.components = rootComponents;
				}
			} else {
				pco.ssr = false;
			}

			clsCount += pco.count;
			ids.push(id);
			cls.push(pco);
		}

		options.clusters = cls;

		const cpuCount = cpus().length;
		if(cpuCount < clsCount) {
			debugError(`WARNING! CPU core count < cluster workers count, {yellow ${cpuCount}} < {red ${clsCount}}`);
		}
	} else {
		if(rootPages) {
			options.pages = rootPages;
		}
		if(rootComponents) {
			options.components = rootComponents;
		}
	}

	// config loader
	if(configLoaders) {
		const keys = Object.keys(configLoaders);
		if(keys.length > 0) {
			options.configLoaders = {};
			for(let key of keys) {
				options.configLoaders[key] = await importer(configLoaders[key]);
			}
		}
	}

	// daemon
	function toInt(value: any): number | null {
		if(typeof value === "string") {
			value = parseInt(value);
		}
		if(typeof value === "number" && !isNaN(value) && isFinite(value)) {
			return value;
		}
		return null;
	}

	if(daemon && isPlainObject(daemon)) {
		options.daemon = {};
		let {delay, cpuPoint, killSignal, pid} = daemon;

		delay = toInt(delay);
		cpuPoint = toInt(cpuPoint);

		if(typeof killSignal === "string") {
			killSignal = killSignal.trim().toUpperCase();
		}

		if(isDaemonSignal(killSignal)) {
			options.daemon.killSignal = killSignal;
		}

		if(delay != null) {
			const min = 3 * 1000;
			const max = 5 * 60 * 1000;
			options.daemon.delay = delay < min ? min : (delay > max ? max : delay);
		}
		if(cpuPoint != null) {
			const min = 10;
			const max = 2000;
			options.daemon.cpuPoint = cpuPoint < min ? min : (cpuPoint > max ? max : cpuPoint);
		}
		if(pid && typeof pid === "string") {
			options.daemon.pid = pid;
		}
	}

	if(onBuildTimeout != null) {
		if(typeof onBuildTimeout === "number") {
			options.onBuildTimeout = onBuildTimeout;
		} else if(typeof onBuildTimeout === "string") {
			onBuildTimeout = onBuildTimeout.trim();
			if(onBuildTimeout.length > 0) {
				options.onBuildTimeout = onBuildTimeout;
			}
		}
	}

	return options;
}