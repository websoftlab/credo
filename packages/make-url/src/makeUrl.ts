import type { URL } from "./types";
import { pathToPattern } from "@phragon/path-to-pattern";
import { buildQuery } from "./buildQuery";
import { pattern } from "./UrlPattern";

const regHttp = /^https?:/;

export function makeUrl(options: URL.Options): string {
	let {
		name,
		path,
		hash,
		search,
		params,
		cacheable = true,
		host,
		port,
		protocol = "http",
		pattern: p = pattern,
		...rest
	} = options;

	if (name) {
		const pt = p.get(name);
		if (pt) {
			path = pt.matchToPath({ data: params || {} });
		} else {
			path = "/";
		}
		params = null;
	} else {
		if (Array.isArray(path)) {
			path = path.join("/");
		}

		if (typeof path === "string") {
			path = path.trim();
		} else if (path === 0) {
			path = "0";
		} else {
			path = String(path || "/");
		}
	}

	if (!regHttp.test(path)) {
		if (!path.startsWith("/")) {
			path = `/${path}`;
		}
		if (host) {
			let prefix = `${protocol === "https" ? protocol : "http"}://${host}`;
			if (port) {
				prefix += `:${port}`;
			}
			path = prefix + path;
		}
	}

	if (params != null && typeof params === "object") {
		path = pathToPattern(path, { cacheable }).matchToPath({ data: params });
	}

	if (search != null && search) {
		if (typeof search === "string") {
			path += `?${search}`;
		} else if (typeof search === "object") {
			search = buildQuery(search, rest);
			if (search) {
				path += `?${search}`;
			}
		}
	}

	if (hash) {
		if (hash.charAt(0) !== "#") {
			hash = `#${hash}`;
		}
		path += hash;
	}

	return path;
}
