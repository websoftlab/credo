import type { RollupConfigure } from "../types";
import type { Plugin } from "rollup";
import type { BuilderStoreI } from "./BuilderStore";

const SET_ID = Symbol();

function set<T>(builder: RollupBuilder, name: string, value: T) {
	builder[SET_ID].rollup(name, value);
}

export interface RollupBuilderI {
	config(...callback: ((config: RollupConfigure) => void)[]): this;
	plugin(...plugin: Plugin[]): this;
}

export default class RollupBuilder implements RollupBuilderI {
	[SET_ID]: BuilderStoreI;

	constructor(store: BuilderStoreI) {
		this[SET_ID] = store;
	}

	config(...callback: ((config: RollupConfigure) => void)[]): this {
		callback.forEach((c) => {
			set(this, "config", { callback: c });
		});
		return this;
	}

	plugin(...plugin: Plugin[]): this {
		plugin.forEach((p) => {
			set(this, "plugin", { plugin: p });
		});
		return this;
	}
}
