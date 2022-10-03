import { newError } from "@phragon/cli-color";
import { transformFileAsync } from "@babel/core";
import { basename, dirname } from "path";
import {
	cwdSearchFile,
	existsStat,
	readJsonFile,
	exists,
	writeJsonFile,
	writeBundleFile,
	cwdPath,
	createCwdDirectoryIfNotExists,
	fileHash,
} from "../utils";

export function requireConfig(file: string) {
	file = require.resolve(file);
	delete require.cache[file];

	let closure = require(file);

	if (closure.__esModule && closure.default) {
		closure = closure.default;
	} else if (typeof closure !== "function" && closure.config) {
		closure = closure.config;
	}

	if (typeof closure !== "function") {
		let name = basename(file);
		const parent = basename(dirname(file));
		if (parent !== ".phragon") {
			name = `${parent}/${name}`;
		}
		throw newError("{cyan ./%s} config file default function is not defined.", name);
	}

	return closure;
}

export async function prebuild(): Promise<() => void> {
	const file = await cwdSearchFile("./phragon.config");
	if (!file) {
		throw newError("The {yellow phragon.config.[ts,js]} file not found!");
	}

	const hash = await fileHash(file);
	const stat = await existsStat("./phragon.json.install");
	const detail: any = stat ? await readJsonFile(stat.file) : {};

	if (detail.lock) {
		throw newError(`{red Failure.} Previous installation is incomplete!`);
	}

	const configFile = cwdPath(".phragon/config.js");
	if (detail.configHash === hash) {
		if (await exists(configFile)) {
			return requireConfig(configFile);
		}
	}

	const result = await transformFileAsync(file, {
		plugins: [
			{
				visitor: {
					CallExpression(path) {
						const { callee, arguments: args } = path.node;
						if ((callee.type === "Identifier" && callee.name === "require") || callee.type === "Import") {
							const first = args[0];
							if (!first || first.type !== "StringLiteral" || first.value.startsWith(".")) {
								throw path.buildCodeFrameError(
									`You cannot use dynamic or local imports in the phragon.config.ts config file!`
								);
							}
						}
					},
				},
			},
		],
		presets: ["@babel/preset-env", "@babel/preset-typescript"],
	});

	if (!result) {
		throw newError("{cyan ./%s} babel transform failure.", basename(file));
	}

	if (!result.code) {
		throw newError("{cyan ./%s} config file is empty.", basename(file));
	}

	await createCwdDirectoryIfNotExists(".phragon");
	await writeBundleFile("config.js", result.code);
	await writeJsonFile("./phragon.json.install", { ...detail, hash });

	return requireConfig(configFile);
}
