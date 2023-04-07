import { readdir } from "node:fs/promises";

export interface IsEmptyDirOptions {
	ignoreHidden?: boolean;
	ignoreFiles?: string | RegExp | (string | RegExp)[];
}

function ignore(file: string, ignoreList: (string | RegExp)[]) {
	return ignoreList.some((entry) => {
		if (typeof entry === "string") {
			return entry === file;
		} else {
			return entry.test(file);
		}
	});
}

export default async function isEmptyDir(src: string, options: IsEmptyDirOptions = {}) {
	let { ignoreHidden = true, ignoreFiles = [] } = options;
	if (!Array.isArray(ignoreFiles)) {
		ignoreFiles = [ignoreFiles];
	}
	for (const file of await readdir(src)) {
		if ((ignoreHidden && file.startsWith(".")) || ignore(file, ignoreFiles)) {
			continue;
		}
		return false;
	}
	return true;
}
