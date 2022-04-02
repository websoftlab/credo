import type {CredoPlugin} from "../types";
import {asyncResult} from "@credo-js/utils";

function isPluginDefine(obj: any): obj is CredoPlugin.Handler {
	return obj && typeof obj === "object" && obj.path === "string" && obj.importer === "string";
}

export default async function fireHook(
	hooks: CredoPlugin.Hooks | Partial<Record<CredoPlugin.HooksEvent, CredoPlugin.Handler>>,
	hook: CredoPlugin.HooksEvent,
	args: any[] = [],
) {
	let func = hooks[hook];
	if(isPluginDefine(func)) {
		const hookFunc = require(func.path);
		if(func.importer === "default") {
			func = hookFunc.__esModule && hookFunc.default || hookFunc;
		} else {
			func = hookFunc[func.importer];
		}
	}

	if(typeof func !== "function") {
		return;
	}

	await asyncResult(( func as (... args: any[]) => (void | Promise<void>) )(... args.slice()));
}