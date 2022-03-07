import {AppStore} from "@credo-js/lexicon";
import clonePlainObject from "@credo-js/utils/clonePlainObject";
import {observe} from "mobx";
import {makeUrl} from "@credo-js/make-url";
import type Koa from "koa";
import type {URL} from "@credo-js/make-url";
import type {CredoJS, OnMakeURLServerHook, OnAppStateHook, OnResponseHook} from "../types";

export function middleware(credo: CredoJS, options: {
	store: any,
	language: string,
	languages: string[],
	multilingual: boolean,
}) {
	const {
		store,
		language,
		languages,
		multilingual,
	} = options;

	const createMakeUrlHandler = (ctx: Koa.Context): URL.AsyncHandler => async (url) => {
		if(typeof url === "string" || Array.isArray(url)) {
			url = {path: url};
		}
		await credo.hooks.emit<OnMakeURLServerHook>("onMakeURL", {url, ctx});
		return makeUrl(url);
	};

	credo.app.use(async (ctx: Koa.Context, next: Koa.Next) => {

		const val: Record<string, any> = {
			credo, // link to credo
			store: null,
			defaultLanguage: language,
			multilingual,
			languages: languages.slice(),
			makeUrl: createMakeUrlHandler(ctx),
		};

		Object.keys(val).forEach(name => {
			Object.defineProperty(ctx, name, {
				get() { return val[name]; }
			});
		});

		// language getter / setter
		let ctxLanguage = language;

		Object.defineProperty(ctx, "language", {
			enumerable: true,
			configurable: false,
			writable: false,
			get() {
				return ctxLanguage;
			},
			set(value: string) {
				if(languages.includes(value))  {
					ctxLanguage = value;
				}
			}
		});

		const state = typeof store === "function" ? await store(ctx) : clonePlainObject(store);

		// emit hook, update state
		await credo.hooks.emit<OnAppStateHook>("onAppState", {ctx, state});

		const appStore = new AppStore(state);

		await appStore.loadLanguage(ctxLanguage);

		observe(appStore, "language", (prop) => {
			const value = prop.newValue as string;
			if(value && value !== val.language) {
				val.language = value;
			}
		});

		val.store = appStore;

		// emit hook, start response
		await credo.hooks.emit<OnResponseHook>("onResponse", {ctx});

		return next();
	});
}