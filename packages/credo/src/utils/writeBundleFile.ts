import {writeFile} from "fs/promises";
import buildPath from "./buildPath";

export default async function writeBundleFile(file: string, body: string) {
	return writeFile(buildPath(file), body);
}