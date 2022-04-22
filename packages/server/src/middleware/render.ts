import { asyncResult, callIn } from "@credo-js/utils";
import createError from "http-errors";
import type { Context } from "koa";
import type {
	CredoJS,
	Route,
	OnResponseRouteHook,
	OnResponseCompleteHook,
	OnResponseControllerHook,
	OnResponseErrorHook,
} from "../types";

function noCache(): Route.CacheOptions {
	return {
		ttl: 0,
		mode: "body",
		cacheable: () => false,
		getKey: () => "404",
	};
}

function create404(): Route.Context {
	return {
		name: "404",
		controller: {
			name: Symbol(),
			handler: (ctx: Context) => createError(404, ctx.store.translate("system.page.notFound", "Page not found")),
		},
		responder: {
			name: "text",
		},
	};
}

function controllerCall(credo: CredoJS, ctx: Context, caller: Route.Context["controller"]) {
	const { name, handler, props } = caller;
	const args: [Context] | [Context, any] = [ctx];
	if (props != null) {
		args.push(props);
	}
	if (handler) {
		return handler(...args);
	}
	if (typeof name !== "string") {
		throw new Error(`The controller point must be a string`);
	}
	return callIn(credo.controllers, name, args, () => {
		throw new Error(`The "${name}" controller is not defined`);
	});
}

function responderCall(credo: CredoJS, ctx: Context, result: any, caller: Route.Context["responder"]) {
	const { name, props } = caller;
	const res = credo.responders[name];
	if (!res) {
		throw new Error(`The ${name} responder is not defined`);
	}
	return props == null ? res.responder(ctx, result) : res.responder(ctx, result, props);
}

export async function throwError(ctx: Context, error: any, routeContext?: Route.Context, code?: string) {
	const { credo } = ctx;
	await credo.hooks.emit<OnResponseErrorHook>("onResponseError", { ctx, route: routeContext, code, error });
	if (ctx.isBodyEnded) {
		return;
	}

	const name = routeContext?.responder?.name;
	if (name) {
		const res = credo.responders[name];
		if (res && typeof res.error === "function") {
			try {
				return await asyncResult(res.error(ctx, error));
			} catch (err) {
				error = err;
			}
		}
	}

	if (createError.isHttpError(error)) {
		throw error;
	} else {
		ctx.throw(500, ctx.store.translate("system.page.queryError", "Query error"));
	}
}

export function middleware(credo: CredoJS) {
	async function failure(ctx: Context, error: any) {
		ctx.credo.debug("Response failure", error);
		return throwError(ctx, error, ctx.route, typeof error.code === "string" ? error.code : "RESPONSE_FAILURE");
	}

	async function render(ctx: Context, notFound: boolean = false): Promise<void> {
		if (!ctx.route) {
			notFound = true;
		}

		if (notFound) {
			ctx.status = 404;
			if (credo.route.isNotFoundRoute() && credo.route.routeNotFound.method(ctx.method)) {
				ctx.route = credo.route.routeNotFound.context;
			} else if (["GET", "POST"].includes(ctx.method)) {
				ctx.route = create404();
			} else {
				ctx.route = undefined;
			}
		}

		await credo.hooks.emit<OnResponseRouteHook>("onResponseRoute", { ctx, notFound });

		const { route } = ctx;
		if (!route) {
			return ctx.throw(404);
		}

		const { controller, responder, middleware } = route;

		let cache = route.cache,
			cacheable = false,
			cacheKey = "",
			cached = false,
			cacheData: any = {};

		if (middleware && middleware.length > 0) {
			let wait = true;
			const next = async (i: number) => {
				if (i < middleware.length) {
					const { name, props } = middleware[i];
					const handler = credo.middleware[name];
					if (!handler) {
						throw new Error(`The "${name}" extra middleware not defined`);
					}
					const nextFunction = async () => next(i + 1);
					if (props != null) {
						await handler(ctx, nextFunction, props);
					} else {
						await handler(ctx, nextFunction);
					}
				} else {
					wait = false;
				}
			};
			try {
				await next(0);
				if (wait || ctx.isBodyEnded) {
					return;
				}
			} catch (err) {
				return failure(ctx, err);
			}
		}

		if (cache && credo.cache) {
			try {
				cacheable = await asyncResult(cache.cacheable(ctx));
				if (cacheable) {
					cacheKey = await asyncResult(cache.getKey(ctx));
					cacheData = await credo.cache.data(cacheKey);
					if (cacheData && cacheData.mode === cache.mode) {
						cached = true;
					}
				}
			} catch (err) {
				credo.debug.error("Read cache failure", err);
			}
		}

		if (!cache) {
			cache = noCache();
		}

		if (cached) {
			if (cache.mode === "body") {
				ctx.bodyEnd(cacheData.body, cacheData.status, cacheData.type);
			} else {
				try {
					const result = cacheData.body;
					await credo.hooks.emit<OnResponseControllerHook>("onResponseController", { ctx, result });
					await responderCall(credo, ctx, result, responder);
				} catch (err) {
					return failure(ctx, err);
				}
			}
		} else {
			let result: any;
			try {
				result = await controllerCall(credo, ctx, controller);
			} catch (err) {
				return !notFound && createError.isHttpError(err) && err.status === 404
					? render(ctx, true)
					: failure(ctx, err);
			}

			if (result == null) {
				ctx.bodyEnd("", 204);
				return;
			}

			// save cache
			if (cacheable && cache.mode === "controller") {
				credo.cache.save(
					cacheKey,
					{
						mode: "controller",
						body: result,
					},
					{ ttl: cache.ttl }
				);
			}

			try {
				await credo.hooks.emit<OnResponseControllerHook>("onResponseController", { ctx, result });
				await responderCall(credo, ctx, result, responder);
			} catch (err) {
				return failure(ctx, err);
			}
		}

		ctx.cacheable = cacheable;
		ctx.cached = cached;

		try {
			await credo.hooks.emit<OnResponseCompleteHook>("onResponseComplete", { ctx });
		} catch (err) {
			credo.debug.error("Hook:OnResponseComplete failure", err);
		}

		if (
			!cached &&
			ctx.caheable &&
			cache.mode === "body" &&
			ctx.status !== 204 &&
			String(ctx.status).startsWith("20")
		) {
			credo.cache.save(
				cacheKey,
				{
					mode: "body",
					status: ctx.status,
					type: ctx.type,
					body: ctx.body,
				},
				{ ttl: cache.ttl }
			);
		}
	}

	credo.app.use((ctx: Context) => render(ctx));
}
