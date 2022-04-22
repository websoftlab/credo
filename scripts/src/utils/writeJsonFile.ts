import { WriteFileOptions } from "fs";
import { writeFile } from "fs/promises";

export default async function writeJsonFile<T = any>(file: string, data: T, options?: WriteFileOptions | null) {
	return writeFile(file, JSON.stringify(data, null, 2), options);
}
