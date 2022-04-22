import { join } from "path";
import cwdPath from "./cwdPath";

export default function normalizeFilePath(file: string | string[]) {
	if (Array.isArray(file)) {
		// create copy
		file = file.slice();

		let first = file.shift() || "";
		if (first && first.startsWith("./")) {
			first = cwdPath(first);
		}
		file = join(first, ...file);
	} else if (file && file.startsWith("./")) {
		file = cwdPath(file);
	}
	return file;
}
