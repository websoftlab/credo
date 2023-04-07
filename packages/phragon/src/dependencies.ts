import https from "node:https";
import { satisfies } from "semver";
import { newError } from "@phragon/cli-color";
import { PackageJsonUtil } from "./utils";
import { readFile } from "node:fs/promises";
import { debug } from "./debug";
import spawn from "cross-spawn";
import { installJson } from "./plugins/JsonFileInstall";

const regVer = /^\d+(?:\.\d+)+(?:-(?:alpha|beta|rc)(?:\.\d+(?:-[a-z0-9\-]+)?)?)?$/;

function versionValid(val?: string | null) {
	if (typeof val !== "string") {
		return null;
	}
	val = val.trim();
	return regVer.test(val) ? val : null;
}

function isUsingYarn() {
	return (process.env.npm_config_user_agent || "").indexOf("yarn") === 0;
}

function asyncSpanText(command: string, args: string[]) {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args);

		let text: string = "";
		child.stdout?.on("data", (chunk) => {
			text += chunk;
		});

		child.on("close", (code) => {
			if (code !== 0) {
				reject({
					command: `${command} ${args.join(" ")}`,
				});
				return;
			}
			resolve(text);
		});
	});
}

export async function getLatestModuleVersion(name: string): Promise<string> {
	let ver: string | undefined | null;

	// yarn
	if (isUsingYarn()) {
		try {
			const json = await asyncSpanText("yarn", ["info", name, "--json"]);
			const data = JSON.parse(json) || {};

			ver = data.data && data.data["dist-tags"]?.latest;
			if (!ver) {
				const versions = data.data?.versions;
				if (Array.isArray(versions) && versions.length > 0) {
					ver = versions[versions.length - 1];
				}
			}
			if (ver) {
				ver = versionValid(ver);
			}
		} catch (err: any) {
			debug.error("{red yarn} failure. %s", err.message || err.command);
		}
	}

	if (ver) {
		return ver;
	}

	// npm
	try {
		ver = await asyncSpanText("npm", ["view", name, "version"]);
		if (ver) {
			ver = versionValid(ver);
		}
	} catch (err: any) {
		debug.error("{red npm} failure. %s", err.message || err.command);
	}

	if (ver) {
		return ver;
	}

	// get registry query
	const originName = name;
	name = name.replace("/", "%2F");
	try {
		const json = await httpJsonQuery(`https://registry.npmjs.org/-/package/${name}/dist-tags`);
		if (json.latest) {
			return json.latest;
		}
	} catch (err: any) {
		debug.error("{red http request} %s", err.message);
	}

	throw new Error(`The latest version of module ${originName} was not found`);
}

async function httpJsonQuery(url: string) {
	return new Promise<any>((resolve, reject) => {
		https
			.get(url, (res) => {
				if (res.statusCode === 200) {
					let body = "";
					res.on("data", (data) => (body += data));
					res.on("end", () => {
						resolve(JSON.parse(body));
					});
				} else {
					reject(new Error(`HTTP Status error code ${res.statusCode}`));
				}
			})
			.on("error", (err) => {
				reject(err);
			});
	});
}

export function splitModule(name: string) {
	const m = name.match(/^(.+?)@(.+?)$/);
	if (m) {
		return {
			name: m[1],
			version: m[2],
		};
	} else {
		return {
			name,
			version: "latest",
		};
	}
}

export async function getPackageModuleVersion(name: string): Promise<string | null> {
	let ver: string | null = null;

	// yarn
	if (isUsingYarn()) {
		try {
			const text = await asyncSpanText("yarn", ["list", "--pattern", name, "--depth=0", "--json"]);
			const list = text.split(/(\r\n|\n|\r)/g);

			top: for (let line of list) {
				line = line.trim();
				if (line.length < 2 || !line.startsWith("{") || !line.endsWith("}")) {
					continue;
				}

				const json = JSON.parse(line);
				if (json.type !== "tree" || json.data?.type !== "list" || !Array.isArray(json.data.trees)) {
					continue;
				}

				for (const item of json.data.trees) {
					const m = splitModule(item.name);
					if (m.name === name) {
						ver = versionValid(m.version);
						break top;
					}
				}
			}
		} catch (err: any) {
			debug.error("{red yarn} failure. %s", err.message || err.command);
		}
	}

	if (ver) {
		return ver;
	}

	// npm
	try {
		const text = await asyncSpanText("npm", ["ls", name, "--depth=0", "--json"]);
		const json = JSON.parse(text);
		if (json.dependencies && json.dependencies[name]) {
			ver = versionValid(json.dependencies[name].version);
		}
	} catch (err: any) {
		debug.error("{red npm} failure. %s", err.message || err.command);
	}

	if (ver) {
		return ver;
	}

	// try resolve
	try {
		const text = (await readFile(require.resolve(`${name}/package.json`))).toString();
		const json = JSON.parse(text);
		if (json.version) {
			ver = versionValid(json.version);
		}
	} catch (err) {}

	return ver;
}

function arrayToObject(deps: string[] | Record<string, string>): Record<string, string> {
	if (Array.isArray(deps)) {
		const newDeps: Record<string, string> = {};
		for (let module of deps) {
			const { name, version } = splitModule(module);
			newDeps[name] = version;
		}
		return newDeps;
	} else {
		return deps;
	}
}

export function installPackage() {
	let command: string,
		args: string[] = [];
	if (isUsingYarn()) {
		command = "yarn";
	} else {
		command = "npm";
		args.push("install");
	}

	debug("Running {yellow %s} install, please wait...", command);

	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit" });
		child.on("close", (code) => {
			if (code !== 0) {
				reject({
					command: `${command} ${args.join(" ")}`,
				});
				return;
			}
			resolve();
		});
	});
}

export async function uninstallDependencies(dependencies: string | string[]) {
	if (!Array.isArray(dependencies)) {
		dependencies = dependencies ? [dependencies] : [];
	}

	if (!dependencies.length) {
		return;
	}

	const pj = new PackageJsonUtil();

	let update = false;
	for (let name of dependencies) {
		if (await pj.hasIn("dependencies", name)) {
			await pj.removeIn("dependencies", name);
			update = true;
		}
		if (await pj.hasIn("devDependencies", name)) {
			await pj.removeIn("devDependencies", name);
			update = true;
		}
	}

	if (!update) {
		return;
	}

	await installPackage();
}

export async function installDependencies(
	dependencies: string[] | Record<string, string>,
	devDependencies: string[] | Record<string, string> = {},
	beforeInstall?: () => void
) {
	// check package.json file
	const pj = new PackageJsonUtil();
	const fi = installJson();
	const done = fi.inTransaction ? () => {} : await fi.createTransaction(true);

	dependencies = arrayToObject(dependencies);
	devDependencies = arrayToObject(devDependencies);

	let updateDependencies = false;

	function isAny(ver: string) {
		return ver === "*" || ver === "latest";
	}

	async function checkDependencies(list: Record<string, string>, key: "dependencies" | "devDependencies") {
		const modules = Object.keys(list);
		if (!modules.length) {
			return;
		}

		for (let module of modules) {
			const dVer = list[module];
			const isMain = key === "dependencies";

			let ver: string | null = null;
			let updateInstallFile = false;

			ver = await pj.getIn("dependencies", module);
			if (ver == null) {
				ver = await pj.getIn("devDependencies", module);
				if (ver != null && isMain) {
					await pj.removeIn("devDependencies", module);
					await pj.setIn("dependencies", module, ver);
				}
			}

			// Skip verification?
			const iVer = isMain ? fi.getDependency(module) : fi.getDevDependency(module);
			if (ver && iVer === ver && (dVer === ver || isAny(dVer))) {
				continue;
			}

			if (!ver) {
				if (isAny(dVer)) {
					ver = await getLatestModuleVersion(module);
					ver = `^${ver}`;
				} else {
					ver = dVer;
				}
				await pj.setIn(key, module, ver);
				debug(`Added new dependency {yellow %s}`, `${module}@${ver}`);
				updateDependencies = true;
				updateInstallFile = true;
			} else {
				const fallbackVer = ver;
				if (!isAny(dVer)) {
					ver = await getPackageModuleVersion(module);
					if (!ver) {
						throw newError(`The {cyan %s} module is not installed`, module);
					}
					if (!satisfies(ver, dVer)) {
						// ignore types
						if (module.startsWith("@types/")) {
							debug.error(
								`Installed version of module {cyan %s} does not match new dependencies {cyan %s}`,
								`${module}@${ver}`,
								dVer
							);
						} else {
							throw newError(
								`Installed version of module {cyan %s} does not match new dependencies {cyan %s}`,
								`${module}@${ver}`,
								dVer
							);
						}
					}
				}
				if (fallbackVer !== iVer) {
					updateInstallFile = true;
					ver = fallbackVer;
				}
			}

			if (updateInstallFile) {
				fi.setDependency(module, isMain ? ver : null);
				fi.setDevDependency(module, isMain ? null : ver);
			}
		}
	}

	await checkDependencies(dependencies, "dependencies");
	await checkDependencies(devDependencies, "devDependencies");

	if (updateDependencies) {
		if (typeof beforeInstall === "function") {
			beforeInstall();
		}
		await installPackage();
	}

	await done();
}
