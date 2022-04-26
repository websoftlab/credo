import cwdPath from "./cwdPath";
import exists from "./exists";

export default async function cwdSearchExists(file: string | string[], extensions: string[] = [".ts", ".js"]) {
	file = Array.isArray(file) ? cwdPath(...file) : cwdPath(file);
	for (const ext of extensions) {
		if (await exists(`${file}${ext}`)) {
			return true;
		}
	}
	return false;
}
