import type {CredoPlugin} from "../types";
import {readdir} from "fs/promises";
import {cwdPath, copy, cwdSearchExists} from "../utils";
import {join} from "path";
import {debugError} from "../debug";

async function pluginInstallConfig(plugin: CredoPlugin.Plugin, department: CredoPlugin.Department) {
	const {config: configPath, name: pluginName} = plugin;
	if(!configPath) {
		return;
	}

	const all: Record<string, { name: string, type: string }> = {};

	(await readdir(configPath)).forEach(file => {
		const match = file.match(/^(.+?)\.(js|json)$/);
		if(!match) {
			return;
		}
		const [, name, type] = match;
		if(!all[name] || type === "js") {
			all[name] = {name, type};
		}
	});

	const files = Object.values(all);
	if(!files.length) {
		return;
	}

	const saved: string[] = department.get( "config", []);

	for(const file of files) {
		const {name, type} = file; // pluginName
		if(saved.includes(name)) {
			continue;
		}

		let filename: string, directory: string = "config";
		if(name.charAt(0) === "_") {
			filename = name.substring(1);
		} else {
			filename = name;
			directory += `/${pluginName}`;
		}

		const pref = `${directory}/${filename}`;
		if(await cwdSearchExists(pref, [".js", ".json"])) {
			debugError(`Warning! Config file {yellow %s} already exists`, pref);
		} else {
			saved.push(name);
			await copy(cwdPath(`${pref}.${type}`), join(configPath, `${name}.${type}`));
		}
	}

	department.set("config", saved);
}

export default async function pluginInstall(name: string, factory: CredoPlugin.Factory, department: CredoPlugin.Department) {
	const plugin = factory.plugin(name);
	if(!plugin) {
		throw new Error(`Plugin ${name} not found`);
	}

	await pluginInstallConfig(plugin, department);
	await factory.fireHook("onInstall", {name, factory, department});
}