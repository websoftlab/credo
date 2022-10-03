import { AppStore } from "@phragon/app";
import clonePlainObject from "@phragon/utils/clonePlainObject";
import { reaction } from "mobx";
import { makeUrl } from "@phragon/make-url";
import type Koa from "koa";
import type { URL } from "@phragon/make-url";
import type { PhragonJS, OnMakeURLServerHook, OnAppStateHook, OnResponseHook } from "../types";

export function middleware(
	phragon: PhragonJS,
	options: {
		store: any;
		language: string;
		languages: string[];
		multilingual: boolean;
	}
) {
	const { store, language, languages, multilingual } = options;

	const createMakeUrlHandler =
		(ctx: Koa.Context): URL.AsyncHandler =>
		async (url) => {
			if (!url) {
				return "/";
			}
			let routeName: string | undefined;
			if (typeof url === "string" || Array.isArray(url)) {
				url = { path: url };
			} else if (url.name) {
				const { name, params, ...rest } = url;
				routeName = name;
				url = <URL.Options>{
					...rest,
					path: await phragon.route.matchToPath(name, params, ctx),
				};
			}
			const { details = {}, ...opts } = url;
			const event = { url: opts, details, ctx, name: routeName };
			await phragon.hooks.emit<OnMakeURLServerHook>("onMakeURL", event);
			return makeUrl(event.url);
		};

	const BODY_END_KEY: symbol = Symbol();

	function isBodyEnded(ctx: any) {
		return ctx[BODY_END_KEY] === true || !ctx.res.writable;
	}

	phragon.app.use(async (ctx: Koa.Context, next: Koa.Next) => {
		const val: Record<string, any> = {
			phragon, // link to phragon
			store: null,
			defaultLanguage: language,
			multilingual,
			languages: languages.slice(),
			makeUrl: createMakeUrlHandler(ctx),
			bodyEnd(body?: any, statusCode?: number, type?: string) {
				if (isBodyEnded(ctx)) {
					return false;
				}
				if (statusCode) {
					ctx.status = statusCode;
				}
				if (typeof type === "string" && type.length) {
					ctx.type = type;
				}
				if (body == null) {
					if (ctx.body == null) {
						ctx.body = "";
					}
				} else {
					ctx.body = body;
				}
				ctx[BODY_END_KEY as never] = true;
				return true;
			},
			async redirectToRoute(name: string, params?: any) {
				ctx.redirect(await phragon.route.matchToPath(name, params, ctx));
			},
		};

		Object.keys(val).forEach((name) => {
			Object.defineProperty(ctx, name, {
				get() {
					return val[name];
				},
			});
		});

		// language getter / setter
		let ctxLanguage = language;

		Object.defineProperty(ctx, "language", {
			enumerable: true,
			configurable: false,
			get() {
				return ctxLanguage;
			},
			set(value: string) {
				if (languages.includes(value)) {
					ctxLanguage = value;
				}
			},
		});

		Object.defineProperty(ctx, "isBodyEnded", {
			enumerable: true,
			configurable: false,
			get() {
				return isBodyEnded(ctx);
			},
		});

		const state = typeof store === "function" ? await store(ctx) : clonePlainObject(store);

		// emit hook, update state
		await phragon.hooks.emit<OnAppStateHook>("onAppState", { ctx, state });

		const appStore = new AppStore(state);

		await appStore.loadLanguage(ctxLanguage);

		reaction(
			() => appStore.language,
			(value) => {
				if (value && value !== ctxLanguage) {
					ctxLanguage = value;
				}
			}
		);

		val.store = appStore;

		// emit hook, start response
		await phragon.hooks.emit<OnResponseHook>("onResponse", { ctx });

		return next();
	});
}
