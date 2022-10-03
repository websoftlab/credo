import { parsePath } from "history";
import type { To } from "history";

const normalizeHash = (hash: string): string => (!hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash);

const normalizeSearch = (search: string): string =>
	!search || search === "?" ? "" : search.startsWith("?") ? search : `?${search}`;

function resolvePathname(relativePath: string, fromPathname: string): string {
	let segments = fromPathname.replace(/\/+$/, "").split("/");
	let relativeSegments = relativePath.split("/");

	relativeSegments.forEach((segment) => {
		if (segment === "..") {
			// Keep the root "" segment so the pathname starts at /
			if (segments.length > 1) segments.pop();
		} else if (segment !== ".") {
			segments.push(segment);
		}
	});

	return segments.length > 1 ? segments.join("/") : "/";
}

export default function resolvePath(to: To, fromPathname = "/") {
	let { pathname: toPathname, search = "", hash = "" } = typeof to === "string" ? parsePath(to) : to;

	let pathname = toPathname
		? toPathname.startsWith("/")
			? toPathname
			: resolvePathname(toPathname, fromPathname)
		: fromPathname;

	return {
		pathname,
		search: normalizeSearch(search),
		hash: normalizeHash(hash),
	};
}
