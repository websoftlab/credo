import {readdir} from "fs/promises";
import {newError} from "@credo-js/cli-color";
import {
	cwdPath,
	exists,
	readJsonFile,
	writeJsonFile,
	existsStat, createCwdDirectoryIfNotExists, createCwdFileIfNotExists, cwdSearchExists, resolveFile
} from "../utils";
import JsonFileInstall from "./JsonFileInstall";
import pluginInstall from "./pluginInstall";
import {loadAllPlugins, loadPlugin, loadRootPluginOnly} from "./loader";
import {randomBytes} from "crypto";
import {debugError, debugInstall} from "../debug";
import {installDependencies, splitModule} from "../dependencies";
import createPluginFactory from "./createPluginFactory";
import type {CredoPlugin} from "../types";
import docTypeReference from "./docTypeReference";

async function createJsonFileInstall() {
	const fi = new JsonFileInstall();
	await fi.load();

	if(fi.lock) {
		throw newError(`{red Failure.} Previous installation is incomplete!`);
	}

	return fi;
}

function toJSON<T>(value: T) {
	return JSON.stringify(value, null, 2);
}

async function installPlugs(fi?: JsonFileInstall, plugins?: CredoPlugin.Plugin[]) {

	if(!fi) {
		fi = await createJsonFileInstall();
	}

	if(!plugins) {
		plugins = await loadAllPlugins();
	}

	const builder = await createPluginFactory(plugins, Object.keys(fi.plugins));
	for(const plugin of plugins) {
		await installPlug(plugin, builder, fi);
	}
}

async function installPlug(plugin: CredoPlugin.Plugin, factory: CredoPlugin.Factory, fi: JsonFileInstall) {

	const {name} = plugin;

	const installList: string[] = Object.keys(fi.plugins);
	if(installList.includes(name)) {
		return debugInstall(`Plugin {yellow %s} already installed, ignore...`, name);
	}

	const details: Record<string, any> = {};
	const department: CredoPlugin.Department = {
		get name() { return name; },
		get plugin() { return plugin; },
		get<T = any>(key: string, defaultValue?: T): T {
			return details.hasOwnProperty(key) ? details[key] : defaultValue;
		},
		set<T = any>(key: string, value: T) {
			details[key] = value;
		},
		del(key: string) {
			delete details[key];
		}
	};

	debugInstall(`Plugin {yellow %s} installation started...`, name);

	try {
		await fi.transaction(async () => {
			await pluginInstall(name, factory, department);
			installList.push(name);
			fi.plugins[name] = {
				version: plugin.version,
				details,
			};
		});
	} catch(err) {
		debugError(`Plugin {yellow %s} installation failure`, name);
		throw err;
	}

	debugInstall(`Plugin {yellow %s} installation completed`, name);
}

// ---

export async function installCredoJS() {

	const fi = await createJsonFileInstall();
	if(fi.installed) {
		return debugError(`System already {cyan installed}, exit...`);
	}

	debugInstall(`Installation started...`);

	const mkdirList: string[] = [];
	const notEmpty = [
		".credo",
		"dev",
		"build",
	];
	const directories = [
		".credo",
		"dev",
		"build",
		"config",
		"lexicon",
		"pages",
		"src",
	];

	for(const dir of directories) {
		const path = cwdPath(dir);
		const stat = await existsStat(path);
		if(!stat) {
			mkdirList.push(dir);
		} else if(!stat.isDirectory) {
			throw newError("Path {cyan %s} must be a directory", `./${dir}`);
		} else if(notEmpty.includes(dir)) {
			const all = await readdir(path);
			if(all.length) {
				throw newError("Directory {cyan %s} is not empty", `./${dir}`);
			}
		}
	}

	const file = cwdPath("credo.json");
	const stat = await existsStat(file);
	if(!stat) {
		await createCwdDirectoryIfNotExists("public");
		await createCwdFileIfNotExists("public/robots.txt", "User-agent: *\nDisallow: /\n");
		await createCwdFileIfNotExists("credo.json", () => (
			toJSON({
				"dependencies": [],
				"routes": [],
				"public": "./public",
				"controllers": {},
				"services": {},
				"responders": {},
				"options": {
					"renderDriver": false
				}
			})
		));
	} else if(!stat.isFile) {
		throw newError("Path {yellow %s} must be a file", "./credo.json");
	}

	const done = await fi.createTransaction();

	for(const dir of mkdirList) {
		await createCwdDirectoryIfNotExists(dir);
	}

	await createCwdFileIfNotExists(".env", "DEBUG=credo:*");
	await docTypeReference([
		"@credo-js/server", "@credo-js/types"
	]);
	await createCwdFileIfNotExists("tsconfig.json", () => (
		toJSON({
			"compilerOptions": {
				"target": "es6",
				"lib": [
					"esnext"
				],
				"allowJs": true,
				"skipLibCheck": true,
				"esModuleInterop": true,
				"allowSyntheticDefaultImports": true,
				"strict": true,
				"forceConsistentCasingInFileNames": true,
				"noFallthroughCasesInSwitch": true,
				"module": "esnext",
				"moduleResolution": "node",
				"resolveJsonModule": true,
				"isolatedModules": true,
				"noEmit": true,
				"baseUrl": "./",
				"paths": {}
			},
			"exclude": [
				"node_modules"
			],
			"include": [
				"credo-env.d.ts",
				"**/*.ts"
			]
		})
	));

	// configs

	// config.js(on)?
	if(!await cwdSearchExists("config/config", [".js", ".json"])) {
		await createCwdFileIfNotExists("config/config.json", () => (
			toJSON({
				secret: [
					randomBytes(32).toString("hex")
				],
			})
		));
	}

	// lexicon.js(on)?
	if(!await cwdSearchExists("config/lexicon", [".js", ".json"])) {
		await createCwdFileIfNotExists("config/lexicon.json", () => (
			toJSON({
				multilingual: false,
				language: "en",
				languages: [
					"en"
				],
			})
		));
		await createCwdFileIfNotExists("lexicon/en.json", () => (
			toJSON({
				hello: "Hello world!"
			})
		));
	}

	// routes.js(on)?
	if(!await cwdSearchExists("config/routes", [".js", ".json"])) {
		const routes: Array<{name: string, responder: string, path: string, controller: string}> = [];
		const credoJson = await readJsonFile("./credo.json");

		// add hello controller
		if(!credoJson.controllers?.hello && ! await exists("./src/hello-controller.ts") && ! await exists("./src/hello-controller.js")) {
			if(!credoJson.controllers) {
				credoJson.controllers = {};
			}
			credoJson.controllers["hello"] = "./src/hello-controller";
			routes.push({
				name: "hello-world",
				responder: "text",
				path: "/",
				controller: "hello",
			});
			await writeJsonFile("./credo.json", credoJson);
			await createCwdFileIfNotExists("src/hello-controller.ts", () => (
				`import {Context} from "koa";
export default function() {
	return function(ctx: Context) {
		return ctx.store.translate("hello", "Hi!");
	};
}\n`
			));
		}

		await createCwdFileIfNotExists("config/routes.json", () => (
			toJSON({
				routes
			})
		));
	}

	// package.json dependencies

	const dependencies: Record<string, string> = {
		"credo": "latest",
		"@credo-js/server": "latest",
		"@credo-js/responder-text": "latest",
		"@credo-js/responder-json": "latest",
		"@credo-js/responder-static": "latest",
	};

	const credoJson = await readJsonFile("./credo.json");

	// add system page responder
	if(credoJson.options?.renderDriver) {
		dependencies["@credo-js/responder-page"] = "latest";
	}

	await installDependencies(dependencies, {
		"@credo-js/types": "latest"
	});

	// add credo devDependencies
	const credoPackageJson = await resolveFile("@credo-js/server/package.json");
	if(!credoPackageJson) {
		throw newError("Can not resolve {yellow @credo-js/server} package");
	}

	await installDependencies({}, (await readJsonFile(credoPackageJson)).devDependencies || {});

	fi.installed = true;

	await done();

	await installPlugs(fi);
}

export async function installPlugin(module: string) {
	const fi = await createJsonFileInstall();
	if(!fi.installed) {
		throw newError(`{red Failure.} CredoJS system not installed!`);
	}

	const {name, version} = splitModule(module);
	if(fi.has(name)) {
		return debugError("The {yellow %s} plugin already installed", name);
	}

	let plugins: CredoPlugin.Plugin[] = [];

	await fi.transaction(async () => {
		debugInstall("Check dependencies...");

		plugins = await loadPlugin(module);

		const plugin = plugins.find(m => m.name === name);
		if(!plugin) {
			throw newError(`{red Failure.} The {yellow %s} plugin not found`, name);
		}

		// root not defined
		if(!plugins.some(plugin => plugin.root)) {
			const root = await loadRootPluginOnly();
			plugins.unshift(root);
		}

		const data = await readJsonFile("./credo.json");
		if(!data.dependencies) {
			data.dependencies = [];
		}

		// add dependency in ./credo.json file
		if(!data
			.dependencies
			.some((m: string) => splitModule(m).name === name)
		) {
			data.dependencies.push(`${name}@${version === "*" || version === "latest" ? `^${plugin.version}` : version}`);
			await writeJsonFile("./credo.json", data);
		}
	});

	debugInstall(`Installation {cyan %s} plugin started...`, name);

	return installPlugs(fi, plugins);
}

export async function installAllPlugins() {
	return installPlugs();
}
