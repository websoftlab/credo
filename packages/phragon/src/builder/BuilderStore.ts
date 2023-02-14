import type { PhragonPlugin } from "../types";
import { isPlainObject } from "@phragon/utils";

export type StoreType = "phragon" | "rollup" | "webpack";

type DefType = boolean | number | string | null | undefined;

export interface BuilderStoreI {
	add<T extends {}>(type: StoreType, name: string, value: T): void;
	phragon<T extends {}>(name: string, value: T): void;
	rollup<T extends {}>(name: string, value: T): void;
	webpack<T extends {}>(name: string, value: T): void;
	alias(name: string, directory: string): void;
	define(name: string, value: DefType): void;
	extender(name: string, config?: any): void;
	docTypeReference(name?: string | string[]): void;
	env(name: string, value: any): void;
}

const keys: string[] = [
	"phragon:cluster",
	"phragon:cmd",
	"phragon:controller",
	"phragon:extraMiddleware",
	"phragon:lexicon",
	"phragon:middleware",
	"phragon:configLoader",
	"phragon:publicPath",
	"phragon:render",
	"phragon:responder",
	"phragon:service",
	"phragon:buildTimeout",
	"phragon:daemon",
	"phragon:renderable",

	"webpack:vendor",
	"webpack:config",
	"webpack:plugin",
	"webpack:rule",

	"rollup:config",
	"rollup:plugin",
];

const PLUGIN_ID = Symbol();

export default class BuilderStore implements BuilderStoreI {
	[PLUGIN_ID]: PhragonPlugin.Plugin;

	pluginList: PhragonPlugin.Plugin[] = [];
	store: Record<StoreType, Record<string, any>> &
		Record<"alias" | "define" | "env" | "extender" | "docTypeReference", any[]> = {
		phragon: {},
		rollup: {},
		webpack: {},
		alias: [],
		extender: [],
		define: [],
		env: [],
		docTypeReference: [],
	};

	get pluginNameList(): string[] {
		return this.pluginList.map((item) => item.name);
	}

	get plugin() {
		return this[PLUGIN_ID];
	}

	set plugin(plugin: PhragonPlugin.Plugin) {
		this[PLUGIN_ID] = plugin;
		if (this.pluginList.every((p) => p.name !== plugin.name)) {
			this.pluginList.push(plugin);
		}
	}

	constructor(plugin: PhragonPlugin.Plugin) {
		this[PLUGIN_ID] = plugin;
		this.pluginList = [plugin];
	}

	add<T extends {}>(type: StoreType, name: string, value: T) {
		if (!this.store.hasOwnProperty(type)) {
			return;
		}

		// valid type
		const key = `${type}:${name}`;
		if (!keys.includes(key)) {
			return;
		}

		const store = this.store[type];
		if (!store.hasOwnProperty(name)) {
			store[name] = [];
		}

		Object.assign(value, { __plugin: this.plugin });
		store[name].push(value);
	}

	alias(name: string, directory: string) {
		this.store.alias.push({ name, directory, __plugin: this.plugin });
	}

	extender(name: string, config?: any) {
		this.store.extender.push({ name, config: isPlainObject(config) ? config : null, __plugin: this.plugin });
	}

	docTypeReference(name?: string | string[]) {
		if (this.plugin.root) {
			return;
		}
		if (!name) {
			name = ["global"];
		} else if (!Array.isArray(name)) {
			name = [name];
		}
		name.forEach((reference) => {
			this.store.docTypeReference.push({ reference, __plugin: this.plugin });
		});
	}

	define(name: string, value: DefType) {
		this.store.env.push({ name, value, __plugin: this.plugin });
	}

	env(name: string, value: any) {
		this.store.env.push({ name, value, __plugin: this.plugin });
	}

	phragon<T extends {}>(name: string, value: T) {
		this.add("phragon", name, value);
	}

	rollup<T extends {}>(name: string, value: T) {
		this.add("rollup", name, value);
	}

	webpack<T extends {}>(name: string, value: T) {
		this.add("webpack", name, value);
	}
}
