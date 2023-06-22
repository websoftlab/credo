import type BuilderStore from "../BuilderStore";
import type { PhragonPlugin, BuildExtenderResult } from "../../types";
import { newError } from "@phragon/cli-color";
import { join } from "node:path";
import { installDependencies, splitModule } from "../../dependencies";
import { isList } from "./util";

type ExtenderCallback = () => BuildExtenderResult | Promise<BuildExtenderResult>;

const extenderAlias: Record<string, string> = { scss: "sass" };
const extenderLink: string[] = ["resource", "css", "sass", "prettier"];

export default async function extender(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"name", string, { config: any }>[] | undefined = store.store.extender;
	if (!isList(list)) {
		return [];
	}
	const extenderList: ExtenderCallback[] = [];
	for (const item of list) {
		const { config, name: originName, __plugin } = item;
		const { name, version } = splitModule(originName);
		let lower = String(name || "")
			.trim()
			.toLowerCase();
		if (extenderAlias.hasOwnProperty(lower)) {
			lower = extenderAlias[lower];
		}
		const moduleName = extenderLink.includes(lower) ? `@phragon/extender-${lower}` : name;
		if (!moduleName.startsWith("./")) {
			let ver = version;
			if (/^\d/.test(ver)) {
				ver = `^${ver}`;
			}
			await installDependencies({}, { [moduleName]: ver });
		}
		let closure: any;
		try {
			closure = require(moduleName.startsWith("./") ? join(__plugin.cwd, moduleName) : moduleName);
		} catch (err) {
			if ((err as any).code === "MODULE_NOT_FOUND") {
				throw newError("Extender module {yellow %s} not found", name);
			} else {
				throw err;
			}
		}
		if (closure.__esModule && closure.default) {
			closure = closure.default;
		} else if (typeof closure.extender === "function") {
			closure = closure.extender;
		}
		if (typeof closure !== "function") {
			throw newError("Extender module {yellow %s} default callback is not defined", name);
		}
		if (config == null) {
			extenderList.push(closure);
		} else {
			extenderList.push(() => closure(config));
		}
	}
	return extenderList;
}
