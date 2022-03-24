import type {WorkspacePackageDetail} from "../types";
import cmd from "../cmd";
import {argv, cwdPath, exists} from "../utils";
import {newError} from "../color";

type BuilderBabelOptions = {
	bundle: string,
	src: string,
	dest: string,
}

export default async function babel(_pg: WorkspacePackageDetail, options: BuilderBabelOptions) {

	const babelConfigPath = cwdPath('babel.config.js');
	if(!await exists(babelConfigPath)) {
		throw newError("{yellow %s} not found", "./babel.config.js");
	}

	const verbose = argv().prop.verbose;
	const env = {
		NODE_ENV: 'production',
		BABEL_ENV: options.bundle,
		BUILD_VERBOSE: verbose && (verbose.length === 0 || verbose.includes("babel")) ? "verbose" : undefined,
	};

	const extensions: string[] = [
		'.js',
		'.ts',
		'.tsx'
	];

	const ignore: string[] = [
		'**/*.d.ts',
	];

	const args = [
		"babel",
		'--config-file', babelConfigPath,
		'--extensions', extensions.join(','), options.src,
		'--out-dir', options.dest,
		'--ignore', ignore.join(", ")
	];

	await cmd(`yarn`, args, { env: { ...process.env, ...env } });
};