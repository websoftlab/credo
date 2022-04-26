import { EStat } from "../types";
import { lstat, stat } from "fs/promises";
import normalizeFilePath from "./normalizeFilePath";
import exists from "./exists";

export default async function existsStat(file: string | string[], link = false): Promise<EStat | null> {
	file = normalizeFilePath(file);
	if (!(await exists(file))) {
		return null;
	}
	const info = link ? await lstat(file) : await stat(file);
	return {
		file,
		isFile: info.isFile(),
		isDirectory: info.isDirectory(),
		isSymbolicLink: info.isSymbolicLink(),
		size: info.size,
	};
}
