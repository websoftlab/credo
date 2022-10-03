import type { LoadManifestOptions } from "../types";
import { join as joinPath } from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import request from "./request";

type Manifest = {
	scripts: string[];
	styles: string[];
};

function manifestJSON(data: string): Manifest | null {
	const raw = JSON.parse(data);
	if (raw && raw.client && typeof raw.client === "object") {
		return {
			scripts: raw.client.scripts || [],
			styles: raw.client.styles || [],
		};
	}
	return null;
}

async function readManifest(id?: number) {
	const file = joinPath(process.cwd(), `${__BUNDLE__}/${id ? `client-${id}` : "client"}/manifest.json`);
	if (existsSync(file)) {
		return manifestJSON((await readFile(file)).toString());
	}
	return null;
}

let manifest: Manifest | null = null;

export async function loadManifest(options: LoadManifestOptions): Promise<Manifest> {
	const { mid, envMode, devServerHost, devServerPort } = options;

	if (devServerHost && devServerPort) {
		const query = await request(devServerHost, devServerPort, "/manifest.json");
		const data = manifestJSON(query.data);
		if (data) {
			return data;
		}
	} else if (manifest) {
		return manifest;
	} else {
		const data = await readManifest(mid);
		if (data) {
			if (envMode === "production") {
				manifest = data;
			}
			return data;
		}
	}

	return {
		scripts: [],
		styles: [],
	};
}
