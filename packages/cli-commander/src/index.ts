import type { Constant, ConstantType } from "./types";
import * as constants from "./constants";

export { default as createCommander } from "./createCommander";
export { default as Commander } from "./Commander";
export { default as Command } from "./Command";
export { default as Option } from "./Option";
export { default as Argument } from "./Argument";
export * as constants from "./constants";

function isObj(value: any) {
	return value != null && typeof value === "object";
}

function mergeConstant(type: ConstantType, object: Record<string, string>) {
	if (isObj(constants[type])) {
		Object.assign(constants[type], object);
	}
}

export const constant: Constant = function constant(type, ...args: any[]) {
	if (typeof type === "string") {
		let [a, b] = args;
		if (typeof a === "string") {
			a = {
				[a]: b,
			};
		}
		mergeConstant(type, a);
	} else if (isObj(type)) {
		const types = Object.keys(type) as ConstantType[];
		for (const t of types) {
			mergeConstant(t, type[t]);
		}
	}
};

export type {
	Constant,
	FormatType,
	OptionType,
	ErrorOptionOptions,
	CommanderOptions,
	CommandOptions,
	OptionOptions,
	ArgumentOptions,
} from "./types";
