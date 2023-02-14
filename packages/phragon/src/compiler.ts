import type { BuildMode, PhragonPlugin } from "./types";
import { lstat, readdir } from "fs/promises";
import { join, extname } from "path";
import { createCwdDirectoryIfNotExists, cwdPath, exists, PackageJsonUtil, readJsonFile, writeJsonFile } from "./utils";
import { installPluginProcess } from "./plugins/installer";
import { buildClient, buildLexicon, buildServer, buildPages, buildServerDaemon } from "./generator";
import { installDependencies } from "./dependencies";
import createPluginFactory from "./plugins/createPluginFactory";
import { Builder, prebuild } from "./builder";
import fileHash from "./utils/fileHash";
import { newError } from "@phragon/cli-color";

async function scan(file: string, ext: string[] | null, dump: string[]) {
	const info = await lstat(file);
	if (info.isFile()) {
		if (ext == null || ext.includes(extname(file).toLowerCase())) {
			dump.push(file);
		}
	} else if (info.isDirectory()) {
		for (const file2 of await readdir(file)) {
			await scan(join(file, file2), ext, dump);
		}
	}
	return dump;
}

interface BuildStatFile {
	file: string;
	hash: string;
}

interface BuildStat {
	files: BuildStatFile[];
	lexiconFiles: BuildStatFile[];
	done: boolean;
	lastError: string | null;
	hash: {
		config: string; // .phragon/config.js
		project: string; // package.json
		ts: string; // tsconfig.json
	};
}

async function statHash(): Promise<BuildStat["hash"]> {
	const hash: Partial<BuildStat["hash"]> = {};
	const hashList = {
		config: ".phragon/config.js",
		project: "package.json",
		ts: "tsconfig.json",
	};

	for (const name of Object.keys(hashList) as ("config" | "project" | "ts")[]) {
		const key = hashList[name];
		const file = cwdPath(key);
		if (!(await exists(file))) {
			throw newError("Config file {cyan ./%s} not found", key);
		}
		hash[name] = await fileHash(file);
	}

	return hash as BuildStat["hash"];
}

async function needUpdate(develop: boolean) {
	const statFile = cwdPath(".phragon/stat.json");
	if (!(await exists(statFile))) {
		return true;
	}

	const data: BuildStat = await readJsonFile(statFile);
	if (!data.done) {
		return true;
	}

	const hashList = await statHash();
	for (const name of Object.keys(hashList) as ("config" | "project" | "ts")[]) {
		if (hashList[name] !== data.hash[name]) {
			return true;
		}
	}

	const compare = develop
		? async (files: BuildStatFile[], file: string) => files.some((f) => f.file === file)
		: async (files: BuildStatFile[], file: string) => {
				const f = files.find((f) => f.file === file);
				if (!f) {
					return false;
				}
				return (await fileHash(file)) === f.hash;
		  };

	const lexiconPath = cwdPath("lexicon");
	const files = await scan(cwdPath(".phragon"), [".json", ".js"], []);
	const lexiconFiles = (await exists(lexiconPath)) ? await scan(lexiconPath, [".json", ".js", ".ts"], []) : [];

	if (files.length !== data.files.length || lexiconFiles.length !== data.lexiconFiles.length) {
		return true;
	}

	for (const file of files) {
		if (!(await compare(data.files, file))) {
			return true;
		}
	}

	for (const file of lexiconFiles) {
		if (!(await compare(data.lexiconFiles, file))) {
			return true;
		}
	}

	return false;
}

export default async function compiler(mode: BuildMode = "development"): Promise<PhragonPlugin.Factory> {
	const { name, version } = await new PackageJsonUtil().load();
	const builder = new Builder(name, version);

	// load config file
	await builder.defineConfig(await prebuild());

	// install/update plugins
	await installPluginProcess(builder.pluginList);

	const isDev = mode === "development";
	const dist = isDev ? "dev" : "build";

	await createCwdDirectoryIfNotExists(dist);

	const factory = await createPluginFactory(builder);
	const rebuild = await needUpdate(isDev);

	if (rebuild) {
		const stat: BuildStat = {
			hash: await statHash(),
			files: [],
			lexiconFiles: [],
			done: false,
			lastError: null,
		};

		try {
			const { render } = factory;
			if (render) {
				await installDependencies(render.dependencies || {}, render.devDependencies || {});
				await installDependencies({ "@phragon/responder-page": "latest" });
			}

			await buildLexicon(factory);
			await buildPages(factory);
			await buildClient(factory);
			await buildServer(factory);
			await buildServerDaemon(factory);

			async function calcHash(dump: BuildStatFile[], files: string[]) {
				for (const file of files) {
					dump.push({
						file,
						hash: await fileHash(file),
					});
				}
			}

			await calcHash(stat.files, await scan(cwdPath(".phragon"), [".json", ".js"], []));

			const lexiconPath = cwdPath("lexicon");
			if (await exists(lexiconPath)) {
				await calcHash(stat.lexiconFiles, await scan(lexiconPath, [".json", ".js", ".ts"], []));
			}

			stat.done = true;
		} catch (err) {
			stat.lastError = (err as Error).message || "Build error";
			throw err;
		} finally {
			await writeJsonFile(cwdPath(".phragon/stat.json"), stat);
		}
	}

	await factory.fireHook("onBuild", factory);

	return factory;
}
