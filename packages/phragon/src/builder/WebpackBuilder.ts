import type { Compiler, WebpackPluginInstance, RuleSetRule } from "webpack";
import type { WebpackConfigure, BuildConfigure } from "../types";
import type { BuilderStoreI } from "./BuilderStore";

const SET_ID = Symbol();

function set<T extends {}>(builder: WebpackBuilder, name: string, value: T) {
	builder[SET_ID].webpack(name, value);
}

export interface WebpackBuilderI {
	config(...callback: ((webpack: WebpackConfigure, config: BuildConfigure) => void)[]): this;
	addVendorChunk(...args: (string | RegExp | Function)[]): this;
	rule(...rule: RuleSetRule[]): this;
	plugin(...plugin: (((this: Compiler, compiler: Compiler) => void) | WebpackPluginInstance)[]): this;
}

export default class WebpackBuilder implements WebpackBuilderI {
	[SET_ID]: BuilderStoreI;
	constructor(store: BuilderStoreI) {
		this[SET_ID] = store;
	}

	addVendorChunk(...args: (string | RegExp | Function)[]): this {
		args.forEach((vendor) => {
			set(this, "vendor", { vendor });
		});
		return this;
	}

	config(...callback: ((webpack: WebpackConfigure, config: BuildConfigure) => void)[]): this {
		callback.forEach((c) => {
			set(this, "config", { callback: c });
		});
		return this;
	}

	plugin(...plugin: (((this: Compiler, compiler: Compiler) => void) | WebpackPluginInstance)[]): this {
		plugin.forEach((p) => {
			set(this, "plugin", { plugin: p });
		});
		return this;
	}

	rule(...rule: RuleSetRule[]): this {
		rule.forEach((r) => {
			set(this, "rule", { rule: r });
		});
		return this;
	}
}
