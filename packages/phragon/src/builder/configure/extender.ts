import type BuilderStore from "../BuilderStore";
import type Builder from "../Builder";
import type { PhragonPlugin } from "../../types";
import { newError } from "@phragon/cli-color";
import { join } from "path";
import { installDependencies, splitModule } from "../../dependencies";
import { isList } from "./util";

type ExtenderCallback = (builder: Builder) => void | Promise<void>;

const extenderAlias: Record<string, string> = { sass: "scss" };
const extenderLink: string[] = ["css", "scss", "react-svg"];

export default async function extender(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"name", string, { config: any }>[] | undefined = store.store.webpack.extender;
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
		const moduleName = extenderLink.includes(lower) ? `@phragon/webpack-extender-${lower}` : name;
		if (!moduleName.startsWith("./")) {
			let ver = version;
			if (/^\d/.test(ver)) {
				ver = `^${ver}`;
			}
			await installDependencies({}, { [moduleName]: ver });
		}
		let closure: any;
		try {
			closure = require(moduleName.startsWith("./")
				? join(__plugin.cwd, moduleName)
				: `${moduleName}/phragon.extender`);
		} catch (err) {
			if ((err as any).code === "MODULE_NOT_FOUND") {
				throw newError("Extender module {yellow %s} not found", name);
			} else {
				throw err;
			}
		}
		if (closure.__esModule && closure.default) {
			closure = closure.default;
		}
		if (typeof closure !== "function") {
			throw newError("Extender module {yellow %s} default callback is not defined", name);
		}
		if (config == null) {
			extenderList.push(closure);
		} else {
			extenderList.push((builder: Builder) => closure(builder, config));
		}
	}
	return extenderList;
}
