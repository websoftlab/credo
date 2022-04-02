import {join as joinPath} from "path";
import {existsSync} from "fs";
import {readFile} from "fs/promises";
import http from "http";
import type {LoadManifestOptions} from "../types";

type Manifest = {
	scripts: string[];
	styles: string[];
}

function manifestJSON(data: string): Manifest | null {
	const raw = JSON.parse(data);
	if(raw && raw.client && typeof raw.client === "object") {
		return {
			scripts: raw.client.scripts || [],
			styles: raw.client.styles || [],
		};
	}
	return null;
}

async function loadDevManifest(host: string, port: number): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		http
			.request({host, port, path: "/manifest.json"}, (response) => {
				let data = "";
				response.on('data', (chunk) => { data += chunk; });
				response.on('end', () => {
					String(response.statusCode).startsWith("20")
						? resolve(data)
						: reject(new Error(`Load error. HTTP Status ${response.statusCode}`));
				});
				response.on('error', (error) => { reject(error); });
			})
			.end();
	});
}

async function readManifest(id?: number) {
	const file = joinPath(process.cwd(), `${__BUNDLE__}/${id ? `client-${id}` : "client"}/manifest.json`);
	if(existsSync(file)) {
		return manifestJSON((await readFile(file)).toString());
	}
	return null;
}

let manifest: Manifest | null = null;

export async function loadManifest(options: LoadManifestOptions): Promise<Manifest> {
	const {
		mid,
		envMode,
		devServerHost,
		devServerPort,
	} = options;

	if(devServerHost && devServerPort) {
		const data = manifestJSON(await loadDevManifest(devServerHost, devServerPort));
		if(data) {
			return data;
		}
	} else if(manifest) {
		return manifest;
	} else {
		const data = await readManifest(mid);
		if(data) {
			if(envMode === "production") {
				manifest = data;
			}
			return data;
		}
	}

	return {
		scripts: [], styles: []
	}
}