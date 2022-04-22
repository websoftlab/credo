import { WriteFileOptions } from "fs";
import { writeFile } from "fs/promises";
import normalizeFilePath from "./normalizeFilePath";

export default async function writeJsonFile(file: string, data: any, options?: WriteFileOptions | null) {
	file = normalizeFilePath(file);
	return writeFile(file, JSON.stringify(data, null, 2), options);
}
