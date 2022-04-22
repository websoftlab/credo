import { join } from "path";

function normalize(src: string, pref: string = ".") {
	if (src.includes("\\")) {
		src = src.replace(/\\/g, "/");
	}
	if (pref && src.charAt(0) === "/") {
		src = pref + src;
	}
	return src;
}

export default function localPathName(file: string) {
	const cwd = process.cwd();
	if (file === cwd) {
		return "./";
	}
	const prefCmp = join(cwd, "node_modules/credo");
	if (file.length > prefCmp.length && file.substring(0, prefCmp.length) === prefCmp) {
		return normalize(file.substring(prefCmp.length), "~");
	} else if (file.length > cwd.length && file.substring(0, cwd.length) === cwd) {
		return normalize(file.substring(cwd.length));
	} else {
		return normalize(file);
	}
}
