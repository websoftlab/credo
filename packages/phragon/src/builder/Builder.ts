import type { PhragonBuilderI } from "./PhragonBuilder";
import type { RollupBuilderI } from "./RollupBuilder";
import type { WebpackBuilderI } from "./WebpackBuilder";
import type { PhragonPlugin } from "../types";
import BuilderStore from "./BuilderStore";
import PhragonBuilder from "./PhragonBuilder";
import RollupBuilder from "./RollupBuilder";
import WebpackBuilder from "./WebpackBuilder";
import { toAsync } from "@phragon-util/async";
import { getLatestModuleVersion, installDependencies } from "../dependencies";
import { newError } from "@phragon/cli-color";
import { requireConfig } from "./prebuild";
import { dirname, join } from "node:path";
import { debug } from "../debug";

type PlainType = boolean | number | string | null | undefined;

export interface BuilderI {
	readonly webpack: WebpackBuilderI;
	readonly rollup: RollupBuilderI;
	readonly phragon: PhragonBuilderI;
	readonly pluginList: PhragonPlugin.Plugin[];

	plugin(name: string, version?: string): Promise<void>;
	alias(object: Record<string, string>): this;
	alias(name: string, directory: string): this;
	define(object: Record<string, PlainType>): this;
	define(name: string, value: PlainType): this;
	env(object: Record<string, any>): this;
	env(name: string, value: any): this;
	on(eventName: string, callback: Function): this;
	once(eventName: string, callback: Function): this;
	off(eventName: string, callback: Function): this;
	extender(name: string, config?: any): this; // css | scss | less | etc. ...
	docTypeReference(name?: string | string[]): this;
}

const eventNames: string[] = ["onOptions", "onBuild", "onInstall", "onRollupConfigure", "onWebpackConfigure"];
const PID = Symbol();

type AccessType = "init" | "load" | "run";

function _access(builder: Builder, level: AccessType | AccessType[]) {
	if (!Array.isArray(level)) {
		level = [level];
	}
	if (!level.some((def) => def === builder[PID].def)) {
		throw new Error("Access denied");
	}
}

function _store(builder: Builder, level?: AccessType | AccessType[]) {
	if (level) {
		_access(builder, level);
	}
	return builder[PID].store;
}

function _events(builder: Builder, level?: AccessType | AccessType[]) {
	if (level) {
		_access(builder, level);
	}
	return builder[PID].events;
}

function _on(builder: Builder, eventName: string, listener: Function, once: boolean) {
	if (!eventNames.includes(eventName)) {
		throw new Error(`Invalid event name ${eventName}`);
	}
	if (typeof listener !== "function") {
		throw new Error("Event listener must be a function");
	}
	const e = _events(builder);
	if (!e[eventName]) {
		e[eventName] = [{ listener, once }];
	} else if (e[eventName].findIndex((evn) => evn.listener === listener) === -1) {
		e[eventName].push({ listener, once });
	}
}

function param<T>(name: string | Record<string, T>, value: T | undefined, callback: (name: string, value: T) => void) {
	if (typeof name === "object" && name != null) {
		Object.keys(name).forEach((key) => callback(key, name[key]));
	} else {
		callback(name, value as T);
	}
}

function getPlugin(name: string, version: string, cwd: string, root: boolean = false): PhragonPlugin.Plugin {
	const plugin: PhragonPlugin.Plugin = {
		name,
		version,
		cwd,
		root,
		joinPath(...args): string {
			return join(cwd, ...args);
		},
	};
	Object.freeze(plugin);
	return plugin;
}

export default class Builder implements BuilderI {
	[PID]: {
		store: BuilderStore;
		events: Record<string, { listener: Function; once: boolean }[]>;
		plugin: PhragonPlugin.Plugin[];
		parentPluginName: string[];
		def: AccessType;
	};

	readonly phragon: PhragonBuilder;
	readonly rollup: RollupBuilder;
	readonly webpack: WebpackBuilder;

	constructor(name: string, version: string = "1.0.0") {
		const plugin = getPlugin(name, version, process.cwd(), true);
		const store = new BuilderStore(plugin);

		this.phragon = new PhragonBuilder(store);
		this.rollup = new RollupBuilder(store);
		this.webpack = new WebpackBuilder(store);

		this[PID] = {
			store,
			events: {},
			plugin: [plugin],
			parentPluginName: [name],
			def: "init",
		};
	}

	get pluginList(): PhragonPlugin.Plugin[] {
		return this[PID].plugin.slice();
	}

	async plugin(name: string, version?: string) {
		_access(this, "load");

		const prv = this[PID];
		if (prv.parentPluginName.includes(name)) {
			throw newError("Recursive plugin dependencies {red %s}", prv.parentPluginName.join(" -> "));
		}

		if (!version) {
			const ver = await getLatestModuleVersion(name);
			if (!ver) {
				throw newError("Can't load module {yellow %s} version", name);
			}
			version = `^${ver}`;
		}

		await installDependencies({ [name]: version });

		// ignore, already loaded
		if (prv.plugin.some((p) => p.name === name)) {
			return;
		}

		const storePlugin = prv.store.plugin;
		prv.parentPluginName.push(name);

		let path: string, packageJsonVersion: string;
		try {
			path = require.resolve(`${name}/phragon.config.js`);
			packageJsonVersion = require(`${name}/package.json`).version || "1.0.0";
		} catch (err) {
			throw newError(
				"The {yellow %s} or {yellow %s} plugin config file not found!",
				`${name}/phragon.config.js`,
				`${name}/package.json`
			);
		}

		const plugin: PhragonPlugin.Plugin = getPlugin(name, packageJsonVersion, dirname(path));

		prv.store.plugin = plugin;

		await toAsync(requireConfig(path)(this));

		const index = prv.parentPluginName.indexOf(name);
		if (index !== -1) {
			prv.parentPluginName.splice(index, 1);
		}

		prv.store.plugin = storePlugin;
		prv.plugin.push(plugin);
	}

	extender(name: string, config?: any): this {
		_store(this, ["load", "init"]).extender(name, config);
		return this;
	}

	docTypeReference(name?: string | string[]): this {
		_store(this, ["load", "init"]).docTypeReference(name);
		return this;
	}

	alias(object: Record<string, string>): this;
	alias(name: string, directory: string): this;
	alias(name: string | Record<string, string>, directory?: string): this {
		param(name, directory, (name, directory) => {
			_store(this, ["load", "init"]).alias(name, directory);
		});
		return this;
	}

	define(object: Record<string, PlainType>): this;
	define(name: string, value: PlainType): this;
	define(name: string | Record<string, PlainType>, value?: PlainType): this {
		param(name, value, (name: string, value: PlainType) => {
			_store(this, ["load", "init"]).define(name, value);
		});
		return this;
	}

	env(object: Record<string, any>): this;
	env(name: string, value: any): this;
	env(name: string | Record<string, any>, value?: any): this {
		param(name, value, (name: string, value: any) => {
			_store(this, ["load", "init"]).env(name, value);
		});
		return this;
	}

	off(eventName: string, listener: Function): this {
		const e = _events(this);
		if (eventNames.includes(eventName) && e[eventName]) {
			const index = e[eventName].findIndex((evn) => evn.listener === listener);
			if (index !== -1) {
				e[eventName].splice(index, 1);
				if (e[eventName].length === 0) {
					delete e[eventName];
				}
			}
		}
		return this;
	}

	on(eventName: string, listener: Function): this {
		_on(this, eventName, listener, false);
		return this;
	}

	once(eventName: string, listener: Function): this {
		_on(this, eventName, listener, true);
		return this;
	}

	// system access

	getStore() {
		return _store(this, "run");
	}

	async defineConfig(callback: (builder: BuilderI) => void | Promise<void>) {
		_access(this, "init");

		const prv = this[PID];

		prv.def = "load";
		await toAsync(callback(this));
		prv.def = "run";
	}

	async emit<Event = unknown>(eventName: string, event?: Event) {
		const e = _events(this, "run");
		if (!e.hasOwnProperty(eventName)) {
			return;
		}
		const list = e[eventName].slice();
		for (const item of list) {
			const { once, listener } = item;
			if (once) {
				this.off(eventName, listener);
			}
			try {
				await toAsync(listener(event));
			} catch (err) {
				debug.error("The {cyan %s} event error", eventName);
				throw err;
			}
		}
	}
}
