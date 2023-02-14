#!/usr/bin/env node

import { createCommander } from "@phragon/cli-commander";
import { join } from "path";
import prettier from "./prettier";

const pg = require(join(__dirname, "package.json"));
const bin = createCommander({
	prompt: "phragon-prettier",
	version: pg.version,
	description: `${pg.name} ${pg.description || ""}`,
});

bin("*")
	.description("Compiles the project files")
	.strict(true)
	.action(async (name) => {
		if (name) {
			throw new Error("Prettier should run without arguments");
		}
		await prettier();
		return 0;
	});

bin.begin()
	.then((code) => {
		if (code !== -1) {
			process.exit(code);
		}
	})
	.catch((err) => {
		throw err;
	});
