import type {Context} from "koa";
import type {CredoJS} from "@credo-js/server";
import type {OnAppStateHook} from "../types";
import {AppStore} from "@credo-js/lexicon";
import {observe} from "mobx";
import {clonePlainObject} from "@credo-js/utils";

export async function createServerAppStore(ctx: Context, originState: any) {
	const state = typeof originState === "function" ? await originState(ctx) : clonePlainObject(originState);
	const appStore = new AppStore(state);

	// emit hook, update state
	const credo: CredoJS = ctx.credo;
	await credo.hooks.emit<OnAppStateHook>("onAppState", {ctx, state});
	await appStore.loadLanguage(ctx.language);

	observe(appStore, "language", (prop) => {
		const value = prop.newValue as string;
		if(value && value !== ctx.language) {
			ctx.language = value;
		}
	});

	return appStore;
}