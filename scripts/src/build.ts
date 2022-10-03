import { loadPackages } from "./workspace";
import { cwd, clear, move, readJsonFile, writeJsonFile, exists, isObj, argv } from "./utils";
import debug from "./debug";
import createBuild from "./builders/createBuild";
import prompts from "prompts";
import { incrementVersion } from "./version";
import release from "./builders/release";
import { mkdir, rmdir } from "fs/promises";
import type { BundleVersionJson, WorkspacePackageDetail } from "./types";

async function updateVersion(pg: WorkspacePackageDetail, deps: Record<string, string>) {
	const originData = await readJsonFile(pg.cwdPath("package.json"));
	const outFile = pg.outPath("package.json");
	const outData = await readJsonFile(outFile);

	if (deps[pg.name]) {
		outData.version = deps[pg.name];
	}

	const depNames = ["dependencies", "devDependencies", "peerDependencies"];

	function lastVer(name: string, dep: any) {
		if (!outData[name]) {
			outData[name] = {};
		}
		for (const key of Object.keys(dep)) {
			const ver = dep[key];
			if (deps.hasOwnProperty(key) && (ver === "*" || ver === "latest")) {
				outData[name][key] = `^${deps[key]}`;
			}
		}
	}

	for (const name of depNames) {
		const dep = originData[name];
		if (isObj(dep)) {
			lastVer(name, dep);
		}
	}

	await writeJsonFile(outFile, outData);
}

async function copyTmpBuild(pg: WorkspacePackageDetail) {
	await clear(pg.out);
	if (!(await exists(pg.out))) {
		await mkdir(pg.out);
	}
	debug("Move [tmp] -> [out] for the {cyan %s} package", pg.name);
	await move(pg.tmp, pg.out);
	rmdir(pg.tmp).catch((err) => {
		debug("Can't remove tmp dir {yellow %s}", pg.tmp, err);
	});
}

async function run() {
	const all = await loadPackages();
	const requiredNames: string[] = [];

	function getPg(name: string): WorkspacePackageDetail {
		return all.find((pg) => pg.name === name) as WorkspacePackageDetail;
	}

	for (const pg of all) {
		if (pg.nextVersion) {
			requiredNames.push(pg.name);
		}
	}

	if (!requiredNames.length) {
		return debug("Modified packages not found. Exit...");
	}

	const alt = requiredNames.slice();
	const add: string[] = [];
	let index = 0;

	// create dependencies
	while (index < alt.length) {
		const name = alt[index++];
		for (const pg of all) {
			if (name !== pg.name && pg.dependencies.includes(name) && !alt.includes(pg.name)) {
				alt.push(pg.name);
				if (!pg.latestVersion) {
					// package build is not exists, build required
					if (!requiredNames.includes(pg.name)) {
						requiredNames.push(pg.name);
					}
				} else if (!requiredNames.includes(pg.name)) {
					add.push(pg.name);
				}
			}
		}
	}

	const buildPg = requiredNames.slice();
	if (add.length > 0) {
		const question = await prompts({
			type: "multiselect",
			name: "name",
			message: "Select the name of the dependency package(s) to rebuild (if necessary)",
			choices: add.map((name) => ({
				title: name,
				value: name,
			})),
		});
		if (question.name) {
			buildPg.push(...question.name);
		}
	}

	// add Version (dynamic)

	for (const name of add) {
		const pg = getPg(name);
		const ver = incrementVersion(pg.version);
		pg.nextVersion = ver.version;
	}

	const deps: Record<string, string> = {};
	all.forEach((pg) => {
		deps[pg.name] = pg.nextVersion || pg.version;
	});

	// make build
	const done: WorkspacePackageDetail[] = [];
	for (const name of buildPg) {
		const pg = getPg(name);
		try {
			await createBuild(pg, deps);
		} catch (err) {
			done.forEach((pg) => {
				clear(pg.tmp).catch((err) => {
					debug("Clear error", err);
				});
			});
			throw err;
		}
		done.push(pg);
	}

	for (const pg of done) {
		await copyTmpBuild(pg);
	}

	for (const pg of all) {
		// update package.json for non-build packages
		if (add.includes(pg.name) && !buildPg.includes(pg.name)) {
			await updateVersion(pg, deps);
		}
		if (!pg.nextVersion) {
			continue;
		}
		// update bundle-version.json file
		// remove nextVersion
		await writeJsonFile<BundleVersionJson>(pg.cwdPath("bundle-version.json"), {
			version: pg.nextVersion,
			ignoreChannel: pg.ignoreChannel,
			release: pg.release,
		});
	}

	// --releaseChannel <channel-name>
	const { prop } = argv();
	const channel = prop.releaseChannel || [];
	if (channel && channel.length) {
		const scope: string[] = [];
		for (const name of channel) {
			await release(name, scope);
		}
	}
}

async function current() {
	const all = await loadPackages();
	const cwd = process.cwd();
	const pg = all.find((pg) => pg.cwd === cwd);
	if (!pg) {
		throw new Error("Current package not found");
	}

	const deps: Record<string, string> = {};
	all.forEach((pg) => {
		deps[pg.name] = pg.version;
	});

	await createBuild(pg, deps);
	await copyTmpBuild(pg);
}

if (cwd() === process.cwd()) {
	run().catch((err) => {
		debug("Build failure", err);
	});
} else {
	current().catch((err) => {
		debug("Build failure", err);
	});
}
