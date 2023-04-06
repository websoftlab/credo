import type { URL } from "./types";

const regSpace = /\+/g;

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty<T>(object: T, key: keyof T) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

export function parseQuery(query?: string, options: URL.ParseQueryOptions = {}): Record<string, string | string[]> {
	const object: Record<string, string | string[]> = {};
	if (typeof query !== "string" || query === "") {
		return object;
	}

	const { maxKeys } = options;
	let max = 1000;

	if (typeof maxKeys === "number") {
		max = maxKeys;
	}

	const data = query.split("&");
	let { length } = data;

	if (max > 0 && length > max) {
		length = max;
	}

	for (let i = 0, current: string | string[]; i < length; ++i) {
		const line = data[i].replace(regSpace, "%20");
		const index = line.indexOf("=");

		let key: string, val: string;
		if (index >= 0) {
			key = line.substring(0, index);
			val = line.substring(index + 1);
		} else {
			key = line;
			val = "";
		}

		key = decodeURIComponent(key);
		val = decodeURIComponent(val);

		if (!hasOwnProperty(object, key)) {
			object[key] = val;
		} else {
			current = object[key];
			if (Array.isArray(current)) {
				current.push(val);
			} else {
				object[key] = [current, val];
			}
		}
	}

	return object;
}
