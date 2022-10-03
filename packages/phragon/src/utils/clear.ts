import rimraf from "rimraf";
import normalizeFilePath from "./normalizeFilePath";
import existsStat from "./existsStat";
import localPathName from "./localPathName";
import { debug } from "../debug";

export default async function clear(path: string) {
	path = normalizeFilePath(path);
	const stat = await existsStat(path);
	if (!stat) {
		return;
	}
	if (!stat.isDirectory) {
		return debug("Warning! The {yellow %s} path is not directory", localPathName(path));
	}

	debug(`Clearing {yellow %s} ...`, localPathName(path));

	return new Promise<void>((resolve, reject) => {
		rimraf(path, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}
