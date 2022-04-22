import type { EnvMode } from "./types";
import { join } from "path";
import { existsSync } from "fs";

const cache: Record<string, any> = {};

function dot(mode?: EnvMode) {
	const name = mode ? `${mode}.env` : ".env";
	const file = join(process.cwd(), name);
	if (!existsSync(file)) {
		return null;
	}
	const data = require("dotenv").config({ path: file }) || {};
	const { parsed } = data;
	if (parsed) {
		return parsed;
	}
	return null;
}

export default function env(mode?: EnvMode) {
	if (!mode) {
		mode = (process.env.NODE_ENV as EnvMode) || "development";
	}
	if (!cache[mode]) {
		cache[mode] = dot(mode) || dot() || {};
	}
	return cache[mode];
}
