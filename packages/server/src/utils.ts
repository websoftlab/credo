import isWindows from "is-windows";
import envGlobal from "./env";
import {access} from "fs/promises";
import {constants} from "fs";
import cluster from "cluster";
import {isMainThread} from "worker_threads";
import type {EnvMode} from "./types";

// server options

export async function exists(file: string): Promise<boolean> {
	try {
		await access(file, constants.F_OK);
	} catch(err) {
		return false;
	}
	return true;
}

export function isMainProcess(): boolean {
	if(!isMainThread) {
		return false;
	}
	const isPrimary = "isPrimary" in cluster ? (cluster as any).isPrimary : (cluster as any).isMaster;
	if(!isPrimary) {
		return false;
	}
	return typeof process.send !== "function";
}

interface EnvConfig extends Record<string, any> {
	mode: EnvMode;
	host: string;
	port: number;
}

interface EnvOptions extends Partial<Omit<EnvConfig, 'port'>> {
	port?: string | number;
}

function envName(key: string) {
	if(key.startsWith("CREDO_")) {
		key = key.substring(6);
	}
	return key
		.toLowerCase()
		.replace(/_([a-z0-9])/g, (_, alpha: string) => alpha.toUpperCase());
}

function prepare(parsed: any) {
	const result: any = {};
	Object.keys(parsed).forEach(key => {
		result[envName(key)] = parsed[key];
	});
	return result;
}

export function loadOptions(options: EnvOptions = {}): EnvConfig {
	let {
		mode,
		host,
		port,
	} = options;

	if(!host) {
		host = process.env.CREDO_HOST || (isWindows() ? "127.0.0.1" : "0.0.0.0");
	}

	if(!mode) {
		mode = (process.env.NODE_ENV as EnvMode) || "development";
	}

	if(port) {
		if(typeof port !== "number") {
			port = parseInt(port);
		}
	} else {
		port = parseInt(process.env.CREDO_PORT || "3000");
	}

	const data: any = {...options, ...prepare(envGlobal(mode))};
	data.mode = mode;

	if(!data.host) {
		data.host = host;
	}

	if(!data.port) {
		data.port = port;
	} else {
		data.port = parseInt(data.port);
	}

	if(!data.devServerHost) {
		const devHost = process.env.DEV_SERVER_HOST;
		if(devHost) {
			data.devServerHost = devHost;
		}
	}

	if(!data.devServerPort) {
		const devPort = process.env.DEV_SERVER_PORT;
		if(devPort) {
			data.devServerPort = devPort;
		}
	}
	if(data.devServerPort) {
		data.devServerPort = parseInt(data.devServerPort);
	}

	return data;
}
