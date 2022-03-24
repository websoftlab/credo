import {lstat, stat} from "fs/promises";
import exists from "./exists";
import type {EStat} from "../types";

export default async function existsStat(file: string, link = false): Promise<EStat | null> {
	if(!await exists(file)) {
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