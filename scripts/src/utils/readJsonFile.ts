import {readFile} from "fs/promises";

export default async function readJsonFile<T = any>(file: string): Promise<T> {
	return JSON.parse((await readFile(file)).toString());
}