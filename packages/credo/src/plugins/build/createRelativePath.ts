import {join, relative} from "path";

export default function createRelativePath(file: string, base?: string, addExtensions: string[] = []) {
	const extensions: string[] = ["js", "ts", "json"];
	const reExt: string[] = ["js", "ts"];

	if(Array.isArray(addExtensions)) {
		for(let ext of addExtensions) {
			ext = String(ext).trim();
			if(ext.startsWith(".")) {
				ext = ext.substring(1);
			}
			if(ext && !/[^a-z]/.test(ext) && !extensions.includes(ext)) {
				extensions.push(ext);
				reExt.push(ext);
			}
		}
	}

	const cwd = process.cwd();
	const regExt = new RegExp("\\.(?:" + reExt.join("|") + ")$");

	let rel = relative(cwd, file);
	if(/^node_modules[\\/]/.test(rel)) {
		rel = rel.substring(13);
	} else if(base) {
		rel = relative(join(cwd, base), file);
		if(!rel.startsWith(".")) {
			rel = `./${rel}`;
		}
	} else if(!rel.startsWith(".")) {
		rel = `./${rel}`;
	}

	return rel
		.replace(/\\/g, '/')
		.replace(regExt, '');
}