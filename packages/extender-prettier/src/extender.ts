import type { ExtenderPrettierOptions } from "./types";
import { existsStat, readJsonFile, writeJsonFile, cwdPath, PackageJsonUtil } from "phragon/utils/index";
import { installDependencies } from "phragon/dependencies";
import { newError } from "@phragon/cli-color";

const prettierrc = {
	arrowParens: "always",
	bracketSameLine: false,
	bracketSpacing: true,
	embeddedLanguageFormatting: "auto",
	htmlWhitespaceSensitivity: "ignore",
	insertPragma: false,
	jsxSingleQuote: false,
	printWidth: 120,
	proseWrap: "preserve",
	quoteProps: "as-needed",
	requirePragma: false,
	semi: true,
	singleQuote: false,
	tabWidth: 4,
	trailingComma: "es5",
	useTabs: true,
	vueIndentScriptAndStyle: false,
};

async function createOrUpdateJson(file: string, data: any) {
	file = cwdPath(file);
	const stat = await existsStat(file);

	if (!stat) {
		await writeJsonFile(file, data);
	} else if (!stat.isFile) {
		throw newError("WARNING! {yellow %s} path must be a file", file);
	} else {
		const currentData = await readJsonFile(stat.file);
		if (JSON.stringify(currentData) !== JSON.stringify(data)) {
			await writeJsonFile(stat.file, data);
		}
	}
}

export default async function extender(config: ExtenderPrettierOptions = {}) {
	const { scriptName = "prettier", version = "latest", options = {}, ...rest } = config;
	const prettierOptions = { ...prettierrc, ...options };

	await createOrUpdateJson("./.prettierrc.json", prettierOptions);
	await createOrUpdateJson("./.phragon/prettier.json", rest);

	if (version !== "global") {
		await installDependencies(
			{},
			{
				prettier: version,
			}
		);
	}

	if (scriptName) {
		const pg = new PackageJsonUtil();
		const line = await pg.getIn("scripts", scriptName);
		if (line == null) {
			await pg.setIn("scripts", scriptName, "phragon-prettier");
		}
	}
}
