import { readFile } from "fs/promises";
import normalizeFilePath from "./normalizeFilePath";

export default async function readJsonFile(file: string) {
	file = normalizeFilePath(file);
	const data = (await readFile(file)).toString();
	if (!data) {
		return {};
	}
	return JSON.parse(data);
}
