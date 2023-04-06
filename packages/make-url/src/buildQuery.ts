import type { URL } from "./types";

function encodeURIString(value: unknown) {
	switch (typeof value) {
		case "string":
			return encodeURIComponent(value);
		case "boolean":
			return value ? "true" : "false";
		case "number":
			return isFinite(value) ? String(value) : "";
		default:
			return "";
	}
}

export function buildQuery(object: unknown, options: URL.QueryOptions = {}): string {
	if (object == null || typeof object !== "object") {
		return "";
	}

	const build: string[] = [];
	const push = (key: string, value: unknown) => {
		const isNull = options.nullable ? options.nullable(value, key) : value == null;
		if (!isNull) {
			build.push(encodeURIString(key) + "=" + encodeURIString(value));
		}
	};

	if (Array.isArray(object)) {
		object = Object.assign({}, object);
	} else if (object instanceof Set || object instanceof Map) {
		object = Object.fromEntries(object.entries());
	}

	for (const key of Object.keys(object as object)) {
		const value = (object as Record<string, string | number | boolean | null | (string | number)[]>)[key];
		if (Array.isArray(value)) {
			for (const arrayValue of value) {
				push(key, arrayValue);
			}
		} else {
			push(key, value);
		}
	}

	return build.join("&");
}
