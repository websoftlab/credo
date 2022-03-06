import {pathToPattern} from "@credo-js/path-to-pattern";
import type {URL} from "./types";

export type {URL};

function builder(object: any, prefix: string, depth: number, options: URL.QueryOptions) {
	if(object == null) {
		return "";
	}
	const build: string[] = [];
	const push = (key: string, value: any) => {
		const isNull = options.nullable ? options.nullable(value, key) : (value == null);
		if(!isNull) {
			if(typeof value === "object") {
				const part = builder(value, key, depth + 1, options);
				if(part) {
					build.push(part);
				}
			} else {
				build.push(
					encodeURIComponent(key) + "=" + encodeURIComponent(String(value))
				);
			}
		}
	};
	if(depth > 2) {
		return "";
	}
	if(Array.isArray(object) && prefix) {
		prefix += "[]";
		object.forEach(value => {
			push(prefix, value);
		});
	} else if(typeof object === "object") {
		Object.keys(object).forEach(key => {
			let itemKey = key;
			if(prefix) {
				itemKey = `${prefix}[${itemKey}]`;
			}
			push(itemKey, object[key]);
		});
	}
	return build.join("&");
}

export function buildQuery(object: any, options: URL.QueryOptions = {}) {
	return builder(object, "", 0, options);
}

const regHttp = /^https?:/;

export function makeUrl(options: URL.Options) {
	let {
		path,
		hash,
		search,
		params,
		cacheable = true,
		host,
		port,
		protocol = "http",
		... rest
	} = options;

	if(Array.isArray(path)) {
		path = path.join("/");
	}

	path = String(path || "").trim();
	if(!regHttp.test(path)) {
		if(path.charAt(0) !== "/") {
			path = `/${path}`;
		}
		if(host) {
			let prefix = `${protocol === "https" ? protocol : "http"}://${host}`;
			if(port) {
				prefix += `:${port}`;
			}
			path = prefix + path;
		}
	}

	if(params != null && typeof params === "object") {
		path = pathToPattern(path, { cacheable }).replace({ data: params });
	}

	if(search != null && search) {
		if(typeof search === "string") {
			path += `?${search}`;
		} else if(typeof search === "object") {
			search = builder(search, "", 0, rest);
			if(search) {
				path += `?${search}`;
			}
		}
	}

	if(hash) {
		if(hash.charAt(0) !== "#") {
			hash = `#${hash}`;
		}
		path += hash;
	}

	return path;
}