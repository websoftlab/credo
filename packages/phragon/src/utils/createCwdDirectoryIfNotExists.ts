import { mkdir } from "fs/promises";
import { debug } from "../debug";
import cwdPath from "./cwdPath";
import exists from "./exists";
import localPathName from "./localPathName";

export default async function createCwdDirectoryIfNotExists(...args: string[]) {
	const full = cwdPath(...args);
	if (!(await exists(full))) {
		await mkdir(full, { recursive: true });
		debug(`Make directory {yellow %s}`, localPathName(full));
	}
	return full;
}
