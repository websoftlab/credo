import type { StringifyOptions } from "./types";
import { isPlainObject } from "@phragon/utils";
import CmpValue from "./CmpValue";
import isUnescapedName from "./isUnescapedName";

function key(name1: string, name2: string | number) {
	if (name1) {
		return `${name1}.${name2}`;
	} else {
		return String(name2);
	}
}

function escKey(name: string) {
	if (isUnescapedName(name)) {
		return name;
	} else {
		return JSON.stringify(name);
	}
}

function genNull(val: null | undefined, opts: StringifyOptions): string {
	if (opts.plain) {
		return "{}";
	}
	if (opts.nullable === false) {
		return '""';
	}
	if (typeof opts.nullable === "string") {
		return opts.nullable;
	}
	return val === undefined ? "undefined" : "null";
}

function replacerDefault(name: string, value: any, links: any[], opts: StringifyOptions): string {
	if (value instanceof CmpValue) {
		return value.toString();
	}

	if (opts.replacer) {
		const val = opts.replacer(name, value);
		if (val !== value) {
			if (val === undefined) {
				return name === "" ? genNull(val, opts) : "";
			}
			if (val instanceof CmpValue) {
				return val.toString();
			}
			return JSON.stringify(val);
		}
	}

	if (value == null) {
		if (name === "") {
			return genNull(value, opts);
		}
		return value === undefined ? "" : "null";
	}

	if (name === "" && opts.plain && !isPlainObject(value)) {
		return "{}";
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "string") {
		return JSON.stringify(value);
	}

	if (typeof value === "number") {
		if (isNaN(value)) {
			return "NaN";
		}
		if (isFinite(value)) {
			return String(value);
		}
		return value < 0 ? "-Infinity" : "Infinity";
	}

	if (typeof value === "function") {
		return "function() {}";
	}

	// recursive
	if (links.includes(value)) {
		return Array.isArray(value) ? "[]" : "{}";
	}

	if (value instanceof RegExp) {
		return value.toString();
	}

	if (value instanceof Date) {
		return `new Date(${JSON.stringify(value.toUTCString())})`;
	}

	if (Array.isArray(value)) {
		const obj: string[] = [];
		const lnk = [value].concat(links);
		for (let i = 0; i < value.length; i++) {
			const val = replacerDefault(key(name, i), value[i], lnk, opts);
			if (val !== "") {
				obj.push(val as string);
			}
		}
		return obj.length < 1 ? "[]" : `[ ${obj.join(", ")} ]`;
	}

	if (isPlainObject(value)) {
		const obj: string[] = [];
		const lnk = [value].concat(links);
		Object.keys(value).forEach((k) => {
			const val = replacerDefault(key(name, k), value[k], lnk, opts);
			if (val !== "") {
				obj.push(`${escKey(k)}: ${val as string}`);
			}
		});
		return obj.length < 1 ? "{}" : `{ ${obj.join(", ")} }`;
	}

	return "{}";
}

export default function stringify(data: any, options: StringifyOptions = {}) {
	return replacerDefault("", data, [], {
		...options,
		replacer: typeof options.replacer === "function" ? options.replacer : false,
	});
}
