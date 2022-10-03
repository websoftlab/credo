import debug from "./debug";
import prompts from "prompts";
import { conf, cwdPath, exists, localPathName } from "./utils";
import { packageExists } from "./workspace";
import { newError } from "./color";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

async function mkDir(path: string) {
	debug("Make project directory {cyan %s}", localPathName(path));
	await mkdir(path, { recursive: true });
}

async function mkFile<T = string>(path: string, data: T) {
	debug("Create project file {cyan %s}", localPathName(path));
	await writeFile(path, typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

async function run() {
	const data = await prompts([
		{
			type: "text",
			message: "Enter package name:",
			name: "name",
			validate(text: string) {
				return text.length > 1 && /^[a-z](?:[a-z0-9\-_]*[a-z0-9])$/ ? true : "Invalid package name";
			},
		},
		{
			type: "confirm",
			message: "Use organisation name for package?",
			name: "organisation",
			initial: true,
		},
	]);

	const prop = await conf();

	let { name } = data;
	if (data.organisation) {
		name = `${prop.workspace.name}/${name}`;
	}

	if (await packageExists(name)) {
		throw newError("{cyan %s} package already exists", name);
	}

	const directory = cwdPath(`${prop.workspace.path}/${data.name}`);
	if (await exists(directory)) {
		throw newError("{cyan %s} directory already exists", `${prop.workspace.path}/${data.name}`);
	}

	let version = prop.semver.version;
	if (prop.semver.preRelease) {
		version += `-${prop.semver.preRelease}`;
	}

	await mkDir(directory);
	await mkDir(join(directory, "src"));

	await mkFile(join(directory, "src/index.ts"), "export {}");
	await mkFile(join(directory, "global.d.ts"), '/// <reference path="../types/global.d.ts" />');
	await mkFile(join(directory, "bundle-version.json"), { version });
	await mkFile(join(directory, "bundle.json"), {
		src: [
			{
				target: "node",
				output: ".",
			},
			{
				target: "types",
				output: ".",
				"package.json": {
					types: "./index.d.ts",
				},
			},
		],
	});

	await mkFile(join(directory, "tsconfig.json"), {
		extends: "../../tsconfig.json",
	});
	await mkFile(join(directory, "tsconfig.build.json"), {
		extends: "../../tsconfig.build.json",
		compilerOptions: {
			outDir: `./${prop.bundle.out}`,
			rootDir: "./src",
		},
		include: ["./src/**/*", "./global.d.ts"],
	});

	await mkFile(
		join(directory, "README.md"),
		`# ${name}

The project is under construction, the description will be later

## ❯ Install

\`\`\`
$ npm install --save ${name}
\`\`\`
`
	);

	if (prop.bundle.licenseText) {
		await mkFile(join(directory, "LICENSE"), prop.bundle.licenseText);
	}

	await mkFile(join(directory, "package.json"), {
		name,
		version: "1.0.0",
		author: prop.bundle.author,
		license: prop.bundle.license,
		scripts: {
			build: "node ../../scripts/lib/build.js",
			prettier: "node ../../scripts/lib/build-prettier.js",
		},
		dependencies: {},
		exports: {
			"./": "./build/",
			".": {
				require: "./build/index.js",
			},
		},
		types: "build/index.d.ts",
		typesVersions: {
			"*": {
				"build/index.d.ts": ["src/index.ts"],
				"*": ["src/*"],
			},
		},
	});
}

run().catch((err) => {
	debug("Create boilerplate failure", err);
});
