import type { PhragonPlugin, InstallPhragonJSOptions } from "../types";
import type { JsonFileInstall } from "./JsonFileInstall";
import { readdir } from "node:fs/promises";
import { format, newError } from "@phragon/cli-color";
import {
	cwdPath,
	readJsonFile,
	existsStat,
	createCwdDirectoryIfNotExists,
	createCwdFileIfNotExists,
	cwdSearchExists,
	resolveFile,
	PackageJsonUtil,
} from "../utils";
import { installJson } from "./JsonFileInstall";
import { randomBytes } from "node:crypto";
import { debug } from "../debug";
import { installDependencies, uninstallDependencies } from "../dependencies";
import docTypeReference from "./docTypeReference";
import { Builder, prebuild } from "../builder";
import semver from "semver/preload";
import { toAsync } from "@phragon-util/async";
import { isPlainObject } from "@phragon-util/plain-object";
import { phragonLexicon, phragonRender } from "../builder/configure";
import cwdSearchFile from "../utils/cwdSearchFile";
import createPluginFactory from "./createPluginFactory";

async function createJsonFileInstall() {
	const fi = installJson();
	await fi.load();

	if (fi.lock && !(await fi.tryWait())) {
		throw newError(`{red Failure.} Previous build not completed!`);
	}

	return fi;
}

function toJSON<T>(value: T) {
	return JSON.stringify(value, null, 2);
}

// ---

async function process(
	fi: JsonFileInstall,
	options: {
		file?: string;
		name: string;
		version?: string;
		args?: any[];
		action: "install" | "update" | "uninstall";
		message: string;
	}
) {
	const { name, file = `${name}/phragon.config.js`, args = [], version, action, message } = options;
	let plugin: { install?: Function; uninstall?: Function; update?: Function } | undefined;

	try {
		plugin = require(file);
	} catch (err) {
		if (action === "uninstall") {
			debug(`Plugin {yellow %s} not found, ignore uninstall...`, name);
			return fi.transaction(() => {
				delete fi.plugins[name];
			});
		}
		throw newError("The {yellow %s} plugin not found.", name);
	}

	await fi.transaction(async () => {
		const proc = plugin ? plugin[action] : null;
		let details = {};
		if (typeof proc === "function") {
			debug(message);
			details = await toAsync(proc(...args));
		}
		if (action === "uninstall") {
			delete fi.plugins[name];
			await uninstallDependencies(name);
		} else if (version) {
			fi.plugins[name] = {
				version,
				details: isPlainObject(details) ? details : {},
			};
		}
	});
}

export async function installPluginProcess(list: PhragonPlugin.Plugin[], fi?: JsonFileInstall) {
	if (!fi) {
		fi = await createJsonFileInstall();
	}
	if (!fi.installed) {
		throw newError(`{red Failure.} PhragonJS system not installed!`);
	}

	const names = Object.keys(fi.plugins);

	for (const plugin of list) {
		const { name } = plugin;
		const index = names.indexOf(name);
		const file = plugin.joinPath(plugin.root ? "./.phragon/config.js" : "./phragon.config.js");

		if (index === -1) {
			await process(fi, {
				file,
				name,
				version: plugin.version,
				action: "install",
				message: format("Install {yellow %s} plugin", name),
			});
		} else {
			names.splice(index, 1);
			if (semver.lt(plugin.version, fi.plugins[name].version)) {
				debug.error(
					`The installed version of the {yellow %s} plugin is greater than the specified version `,
					name
				);
			} else if (semver.gt(plugin.version, fi.plugins[name].version)) {
				await process(fi, {
					file,
					name,
					version: plugin.version,
					action: "update",
					args: [fi.plugins[name].version, fi.plugins[name].details],
					message: format(
						"Update {yellow %s} plugin {cyan %s} -> {cyan %s}",
						name,
						fi.plugins[name].version,
						plugin.version
					),
				});
			}
		}
	}

	if (names.length > 0) {
		for (const name of names) {
			await process(fi, {
				name,
				action: "uninstall",
				args: [fi.plugins[name].version, fi.plugins[name].details],
				message: format("Uninstall {yellow %s} plugin", name),
			});
		}
	}
}

export async function installPhragonJS(parameters: InstallPhragonJSOptions) {
	const fi = await createJsonFileInstall();
	if (fi.installed) {
		return debug.error(`System already {cyan installed}, exit...`);
	}

	debug(`Installation started...`);

	const mkdirList: string[] = [];
	const notEmpty = [".phragon", "dev", "build"];
	const directories = [".phragon", "dev", "build", "config", "lexicon", "src-client", "src-server", "src-full"];

	for (const dir of directories) {
		const path = cwdPath(dir);
		const stat = await existsStat(path);
		if (!stat) {
			mkdirList.push(dir);
		} else if (!stat.isDirectory) {
			throw newError("Path {cyan %s} must be a directory", `./${dir}`);
		} else if (notEmpty.includes(dir)) {
			const all = await readdir(path);
			if (all.length) {
				throw newError("Directory {cyan %s} is not empty", `./${dir}`);
			}
		}
	}

	// installation options
	const { render } = parameters;
	if (render && !["react"].includes(render)) {
		throw newError("The {cyan %s} render driver is not supported", render);
	}

	for (const dir of mkdirList) {
		await createCwdDirectoryIfNotExists(dir);
	}

	let makeDefault = false;

	const file = await cwdSearchFile("phragon.config");
	if (!file) {
		makeDefault = true;
		await createCwdDirectoryIfNotExists("public");
		await createCwdFileIfNotExists("public/robots.txt", "User-agent: *\nDisallow: /\n");
		await createCwdFileIfNotExists(
			"phragon.config.ts",
			() =>
				`import type { BuilderI } from "phragon";
export default function config(builder: BuilderI) { 
	builder
		.phragon${render ? `\n\t\t.render(${toJSON(render)}, true)` : ""}
		.controller("hello", "./src-server/hello-controller")
		.publicPath("./public"); 
}\n`
		);
		await createCwdFileIfNotExists(
			"src-server/hello-controller.ts",
			() =>
				`import {Context} from "koa";
export default function() {
	return {
		text(ctx: Context) {
			return ctx.store.translate("hello", "Hi!");
		},
		page(ctx: Context) {
			return {
				code: 200,
				data: {
					title: "PhragonJS",
					text: ctx.store.translate("hello", "Hi!"),
				},
			};
		},
	};
}\n`
		);
	}

	const pj = new PackageJsonUtil();
	const { name, version } = await pj.load();
	const builder = new Builder(name, version);

	// load config file
	await builder.defineConfig(await prebuild());

	const renderConfig = await phragonRender(builder.getStore());

	// check, render
	if (render) {
		const userRender = renderConfig?.name;
		if (render !== userRender) {
			throw newError(
				"Phragon JSON render driver and install render driver are not equivalent: {yellow %s} != {yellow %s}",
				userRender || "[no-config-driver]",
				render
			);
		}
	}

	const done = await fi.createTransaction();

	await createCwdFileIfNotExists(".env", "DEBUG=phragon:*");
	await docTypeReference(["@phragon/server", "@phragon/types", "@phragon-util/global-var"]);
	await createCwdFileIfNotExists("tsconfig.json", () =>
		toJSON({
			compilerOptions: {
				target: "es6",
				lib: ["esnext"],
				allowJs: true,
				skipLibCheck: true,
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
				strict: true,
				forceConsistentCasingInFileNames: true,
				noFallthroughCasesInSwitch: true,
				module: "esnext",
				moduleResolution: "node",
				resolveJsonModule: true,
				isolatedModules: true,
				noEmit: true,
				baseUrl: "./",
				paths: {},
			},
			exclude: ["node_modules"],
			include: ["phragon-env.d.ts", "**/*.ts"],
		})
	);

	// configs

	// config.js(on)?
	if (!(await cwdSearchExists("config/config", [".js", ".json"]))) {
		await createCwdFileIfNotExists("config/config.json", () =>
			toJSON({
				secret: [randomBytes(32).toString("hex")],
			})
		);
	}

	// lexicon.js(on)?
	if (!(await cwdSearchExists("config/lexicon", [".js", ".json"]))) {
		const { language, languages, multilingual } = await phragonLexicon(builder.getStore());
		await createCwdFileIfNotExists("config/lexicon.json", () =>
			toJSON({
				multilingual,
				language,
				languages,
			})
		);
		await createCwdFileIfNotExists(`lexicon/${language}.json`, () =>
			toJSON({
				hello: "Hello world!",
			})
		);
	}

	// route.[tj]s?
	if (!(await cwdSearchExists("src-server/route", [".js", ".ts"]))) {
		await createCwdFileIfNotExists("src-server/route.ts", () => {
			let route = `import { createRootRouter } from "@phragon/server";
const router = createRootRouter();
\n`;
			// add hello controller
			if (makeDefault) {
				route +=
					"router.get(" +
					JSON.stringify({
						name: "hello-world",
						responder: renderConfig ? ["page", { page: "page" }] : "text",
						path: "/",
						controller: renderConfig ? "hello.page" : "hello.text",
					}) +
					");\n";
			}
			route += "export default router;\n";
			return route;
		});
	}

	// package.json dependencies

	const dependencies: Record<string, string> = {
		"@phragon/cli-debug": "latest",
		"@phragon-util/global-var": "latest",
		"@phragon-util/async": "latest",
		"@phragon/server": "latest",
		"@phragon/responder-text": "latest",
		"@phragon/responder-json": "latest",
		"@phragon/responder-static": "latest",
	};

	// add system page responder
	if (renderConfig) {
		dependencies["@phragon/responder-page"] = "latest";
	}

	await installDependencies(dependencies, {
		phragon: "latest",
		"@phragon/types": "latest",
		"@types/node": "^14.14.31",
	});

	// add phragon devDependencies
	const phragonPackageJson = await resolveFile("@phragon/server/package.json");
	if (!phragonPackageJson) {
		throw newError("Can not resolve {yellow @phragon/server} package");
	}

	await installDependencies({}, (await readJsonFile(phragonPackageJson)).devDependencies || {});

	// scripts
	const defaultScripts: Record<string, string> = {
		dev: "phragon dev",
		build: "phragon build",
		start: "phragon-serv start",
	};

	for (const key in defaultScripts) {
		if (!(await pj.hasIn("scripts", key))) {
			await pj.setIn("scripts", key, defaultScripts[key]);
		}
	}

	fi.installed = true;

	await done();
	await installPluginProcess(builder.pluginList, fi);

	const factory = await createPluginFactory(builder);
	await factory.fireHook("onInstall", factory);
}
