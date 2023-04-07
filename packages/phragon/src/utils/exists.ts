import { access } from "node:fs/promises";
import { constants } from "node:fs";
import normalizeFilePath from "./normalizeFilePath";

export default async function exists(file: string | string[]): Promise<boolean> {
	file = normalizeFilePath(file);
	try {
		await access(file, constants.F_OK);
	} catch (err) {
		return false;
	}
	return true;
}
