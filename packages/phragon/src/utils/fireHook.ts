import type { PhragonPlugin } from "../types";
import { toAsync } from "@phragon-util/async";

function isPluginDefine(obj: any): obj is PhragonPlugin.Handler {
	return obj && typeof obj === "object" && typeof obj.path === "string" && typeof obj.importer === "string";
}

export default async function fireHook(
	hooks: PhragonPlugin.Hooks | Partial<Record<PhragonPlugin.HooksEvent, PhragonPlugin.Handler>>,
	hook: PhragonPlugin.HooksEvent,
	args: any[] = []
) {
	let func = hooks[hook];
	if (isPluginDefine(func)) {
		const hookFunc = require(func.path);
		if (func.importer === "default") {
			func = (hookFunc.__esModule && hookFunc.default) || hookFunc;
		} else {
			func = hookFunc[func.importer];
		}
	}

	if (typeof func !== "function") {
		return;
	}

	await toAsync((func as (...args: any[]) => void | Promise<void>)(...args.slice()));
}
