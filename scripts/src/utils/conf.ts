import type {Config} from "../types";
import cwdPath from "./cwdPath";
import existsStat from "./existsStat";
import readJsonFile from "./readJsonFile";
import {newError} from "../color";

let data: Config | null = null;

async function load(): Promise<Config> {
	const stat = await existsStat(cwdPath("credo-build.conf.json"));
	if(stat && stat.isFile) {
		return readJsonFile(stat.file);
	}
	throw newError("Config file {yellow %s} not found", "./credo-build.conf.json");
}

export default async function conf(): Promise<Config> {
	if(!data) {
		data = await load();
	}
	return data;
}