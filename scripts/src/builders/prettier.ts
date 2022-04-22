import cmd from "../cmd";
import { cwd, exists } from "../utils";
import { join, sep } from "path";

function joinCwd(file: string) {
	return join(cwd(), file);
}

async function prettierCmd(parser: string, files: string[]) {
	// prettier-ignore
	const args = [
		"--config", joinCwd(".prettierrc.json"),
		"--parser", parser,
		"--write"
	].concat(files);

	return cmd(`prettier`, args, { cwd: cwd() });
}

export default async function prettier(dir: string) {
	const files: string[] = [];

	// base src
	const src = join(dir, "./src");
	if (await exists(src)) {
		files.push([src, "**", "*.{ts,tsx}"].join(sep));
	} else {
		files.push([dir, "*.ts"].join(sep));
	}

	// base types
	const types = join(dir, "./types");
	if (await exists(types)) {
		files.push([types, "**", "*.ts"].join(sep));
	}

	await prettierCmd(`typescript`, files);

	files.length = 0;
	const json: string[] = ["package.json", "bundle.json", "tsconfig.build.json", "tsconfig.json"];

	// other files
	for (const item of json) {
		const file = join(dir, item);
		if (await exists(file)) {
			files.push(file);
		}
	}

	if (files.length > 0) {
		await prettierCmd(`json`, files);
	}
}
