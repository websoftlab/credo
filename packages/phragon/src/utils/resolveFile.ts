import { basename, dirname, join } from "node:path";
import existsStat from "./existsStat";
import exists from "./exists";

export default async function resolveFile(file: string): Promise<string | false> {
	if (!file || typeof file !== "string") {
		return false;
	}

	try {
		return require.resolve(file);
	} catch (err) {}

	if (file.charAt(0) === ".") {
		file = join(process.cwd(), file);
	}

	const stat = await existsStat(file);
	if (stat) {
		if (!stat.isDirectory) {
			try {
				return require.resolve(file);
			} catch (err) {
				return false;
			}
		} else if (basename(file) !== "index") {
			file = join(file, "./index");
		}
	} else if (!(await exists(dirname(file)))) {
		return false;
	}

	if (/\.(?:[tj]s|json)$/.test(file)) {
		return false;
	}

	for (let ext of ["ts", "js", "json"]) {
		try {
			return require.resolve(`${file}.${ext}`);
		} catch (err) {}
	}

	return false;
}
