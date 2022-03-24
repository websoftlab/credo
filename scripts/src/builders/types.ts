import cmd from "../cmd";
import {exists} from "../utils";
import {newError} from "../color";
import type {WorkspacePackageDetail} from "../types";

type BuilderTypesOptions = {
	src: string,
	dest: string,
}

export default async function types(pg: WorkspacePackageDetail, options: BuilderTypesOptions) {

	const typescriptConfigPath = pg.cwdPath("./tsconfig.build.json");
	if(!await exists(typescriptConfigPath)) {
		throw newError("Typescript config file {yellow %s} not found", "./tsconfig.build.json");
	}

	const env = {
		NODE_ENV: 'production',
	};

	const args = [
		"tsc",
		"-p", typescriptConfigPath,
		"--rootDir", options.src,
		"--outDir", options.dest,
	];

	await cmd('yarn', args, { env: { ...process.env, ...env } })
};