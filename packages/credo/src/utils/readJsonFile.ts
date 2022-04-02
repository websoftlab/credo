import {readFile} from "fs/promises";
import normalizeFilePath from "./normalizeFilePath";

export default async function readJsonFile(file: string) {
	file = normalizeFilePath(file);
	return JSON.parse((await readFile(file)).toString());
}