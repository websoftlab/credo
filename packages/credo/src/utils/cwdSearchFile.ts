import cwdPath from "./cwdPath";
import existsStat from "./existsStat";

export default async function cwdSearchFile(file: string | string[], extensions: string[] = [".ts", ".js"]) {
	file = Array.isArray(file) ? cwdPath(...file) : cwdPath(file);
	for (const ext of extensions) {
		const stat = await existsStat(`${file}${ext}`);
		if (stat && stat.isFile) {
			return stat.file;
		}
	}
	return null;
}
