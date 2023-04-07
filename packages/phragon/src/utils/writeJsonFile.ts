import { WriteFileOptions } from "node:fs";
import writeFile from "./writeFile";
import normalizeFilePath from "./normalizeFilePath";

export default async function writeJsonFile(file: string, data: any, options?: WriteFileOptions | null) {
	file = normalizeFilePath(file);
	return writeFile(file, JSON.stringify(data, null, 2), options);
}
