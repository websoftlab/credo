import loadRootOptions from "./loadRootOptions";
import {existsStat, readJsonFile, fireHook} from "../utils";
import {installDependencies} from "../dependencies";
import docTypeReference from "./docTypeReference";
import {asyncResult} from "@credo-js/utils";
import type {CredoPlugin} from "../types";

export default async function createPluginFactory(plugins: CredoPlugin.Plugin[], installList?: string[]): Promise<CredoPlugin.Factory> {

	const root = plugins.find(plugin => plugin.root) || null;
	if(!root) {
		throw new Error("Root plugin is not loaded");
	}

	const options = await loadRootOptions(plugins);

	// create links
	const pluginLink: Record<string, CredoPlugin.Plugin> = {};
	plugins.forEach(plugin => {
		pluginLink[plugin.name] = plugin;
	});

	// load install list
	if(!installList) {
		const stat = await existsStat("./credo.json.install");
		if(stat && stat.isFile) {
			installList = Object.keys( (await readJsonFile(stat.file)).plugins );
		} else {
			installList = [];
		}
	}

	// check page responder
	if(options.renderDriver) {
		await docTypeReference("@credo-js/types/global-render");
		if(!plugins.some(plugin => plugin.responders.hasOwnProperty("page"))) {
			await installDependencies(["@credo-js/responder-page"]);
		}
	}

	const listeners: Record<string, Function[]> = {};

	return {
		get root() {
			return root;
		},
		get options() {
			return options;
		},
		get plugins() {
			return plugins;
		},
		plugin(name: string): CredoPlugin.Plugin | null {
			return pluginLink.hasOwnProperty(name) ? pluginLink[name] : null;
		},
		exists(name: string): boolean {
			return pluginLink.hasOwnProperty(name);
		},
		installed(name: string): boolean {
			return installList ? installList.includes(name) : false;
		},
		on(name: CredoPlugin.HooksEvent, listener: Function) {
			if(typeof listener !== "function") {
				return;
			}
			if(!listeners.hasOwnProperty(name)) {
				listeners[name] = [];
			}
			if(!listeners[name].includes(listener)) {
				listeners[name].push(listener);
			}
		},
		off(name: CredoPlugin.HooksEvent, listener?: Function) {
			if(listeners.hasOwnProperty(name)) {
				if(listener) {
					const index = listeners[name].indexOf(listener);
					if(index !== -1) {
						listeners[name].splice(index, 1);
					}
				}
			}
		},
		async fireHook(name: CredoPlugin.HooksEvent, ... args: any[]): Promise<void> {

			for(const plugin of plugins) {
				await fireHook(plugin.hooks, name, args);
			}

			const renderHooks = options.renderDriver?.hooks;
			if(renderHooks) {
				await fireHook(renderHooks, name, args);
			}

			const listen = listeners.hasOwnProperty(name) ? listeners[name] : [];
			if(listen.length) {
				for(const listener of listen) {
					await asyncResult(listener( ... args));
				}
			}
		},
	};
}
