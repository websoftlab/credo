import type { Context } from "koa";
import type { CredoJS, Ctor, Route, RouteVariant } from "@credo-js/server";
import type { ResponderJsonConfigOptions } from "./types";
import { RouteEntity } from "@credo-js/server";
import createHttpError from "http-errors";
import HttpJSON from "./HttpJSON";
import asyncResult from "@credo-js/utils/asyncResult";

type OriginOptions = {
	origin: string;
	credentials: boolean;
};

function getHeaderString(value?: string | string[]): string {
	return value != null ? (Array.isArray(value) ? value.join(",") : value) : "";
}

export default (function responder(credo: CredoJS, name: string): Route.Responder {
	const options: ResponderJsonConfigOptions = credo.config(`responder/${name}`);
	const { cors: corsOption = true, done: doneHandler, error: errorHandler } = options;
	const enabled: boolean = corsOption !== false;
	const cors = enabled && corsOption != null && typeof corsOption === "object" ? corsOption : {};
	const exposeHeaders = getHeaderString(cors.exposeHeaders);
	const { keepHeadersOnError = true } = cors;

	function isDetails(err: any): err is Error & {
		details: any;
	} {
		return "details" in err && err.details != null;
	}

	async function getOptionsMethods(ctx: Context, routes: RouteVariant[], methods: string[]): Promise<string[]> {
		for (const route of routes) {
			if (RouteEntity.isRouteGroup(route)) {
				if (await asyncResult(route.match(ctx, false))) {
					await getOptionsMethods(ctx, route.routes, methods);
				}
				continue;
			}
			if (
				route.context.details?.cors === false ||
				route.context.responder.name !== name ||
				!(await asyncResult(route.match(ctx)))
			) {
				continue;
			}
			route.methods.forEach((name) => {
				if (!methods.includes(name)) {
					methods.push(name);
				}
			});
		}

		return methods;
	}

	function setHeaders(ctx: Context, opts: OriginOptions) {
		const { route } = ctx;
		if ((route && route.details?.cors === false) || (keepHeadersOnError && ctx.status >= 500)) {
			return;
		}

		const { origin, credentials } = opts;

		// Simple Cross-Origin Request, Actual Request, and Redirects
		ctx.set("Access-Control-Allow-Origin", origin);

		if (credentials) {
			ctx.set("Access-Control-Allow-Credentials", "true");
		}

		if (exposeHeaders) {
			ctx.set("Access-Control-Expose-Headers", exposeHeaders);
		}
	}

	function send(ctx: Context, body: HttpJSON) {
		ctx.bodyEnd(body.toJSON(), body.status);
	}

	async function sendError(ctx: Context, error: Error, withOrigin: boolean) {
		if (typeof errorHandler === "function") {
			return send(ctx, await asyncResult(errorHandler(error)));
		}

		if (withOrigin) {
			const opts = await setOrigin(ctx);
			if (opts) {
				setHeaders(ctx, opts);
			}
		}

		let code = 500;
		let message = "";

		if (createHttpError.isHttpError(error)) {
			code = error.status;
			if (error.expose) {
				message = error.message;
			}
		}

		const body: any = {
			code,
			message: message || ctx.store.translate("system.page.queryError", "Query error"),
		};

		if (isDetails(error)) {
			body.details = error.details;
		}

		ctx.bodyEnd(body, code < 600 ? code : 500);
	}

	async function setOrigin(ctx: Context): Promise<OriginOptions | false> {
		if (!enabled) {
			return false;
		}

		// If the Origin header is not present terminate this set of steps.
		// The request is outside the scope of this specification.
		const requestOrigin = ctx.get("Origin");

		// Always set Vary header
		// https://github.com/rs/cors/issues/10
		ctx.vary("Origin");

		if (!requestOrigin) {
			return false;
		}

		let origin: string;
		if (typeof cors.origin === "function") {
			origin = await asyncResult(cors.origin(ctx));
			if (!origin) {
				return false;
			}
		} else {
			origin = cors.origin || requestOrigin;
		}

		let credentials: boolean;
		if (typeof cors.credentials === "function") {
			credentials = await asyncResult<boolean>(cors.credentials(ctx));
		} else {
			credentials = !!cors.credentials;
		}

		return {
			origin,
			credentials,
		};
	}

	async function sendOptions(ctx: Context, opts: OriginOptions) {
		// If there is no Access-Control-Request-Method header or if parsing failed,
		// do not set any additional headers and terminate this set of steps.
		// The request is outside the scope of this specification.
		if (!ctx.get("Access-Control-Request-Method")) {
			// this not preflight request, ignore it
			return;
		}

		const methods = await getOptionsMethods(ctx, credo.route.routeList, []);
		if (!methods.length) {
			return;
		}

		const { origin, credentials } = opts;

		ctx.set("Access-Control-Allow-Origin", origin);
		ctx.set("Access-Control-Allow-Methods", methods.join(","));

		if (credentials) {
			ctx.set("Access-Control-Allow-Credentials", "true");
		}

		if (cors.maxAge) {
			ctx.set("Access-Control-Max-Age", String(cors.maxAge));
		}

		const allowHeaders = getHeaderString(cors.allowHeaders || ctx.get("Access-Control-Request-Headers"));
		if (allowHeaders) {
			ctx.set("Access-Control-Allow-Headers", allowHeaders);
		}

		ctx.bodyEnd("", 204);
	}

	credo.hooks.subscribe("onResponseError", async (event) => {
		const { ctx, code, route } = event;
		if (ctx.method === "OPTIONS" && code === "HTTP_METHOD_NOT_SUPPORTED" && route?.responder?.name === name) {
			const opts = await setOrigin(ctx);
			if (opts) {
				await sendOptions(ctx, opts);
			}
		}
	});

	return {
		name,
		async responder(ctx: Context, body: any) {
			const opts = await setOrigin(ctx);
			if (opts) {
				setHeaders(ctx, opts);
			}
			if (!HttpJSON.isHttpJSON(body)) {
				body = new HttpJSON(body);
			}
			if (typeof doneHandler === "function") {
				try {
					body = await asyncResult(doneHandler(body));
				} catch (err) {
					return sendError(ctx, err as Error, false);
				}
			}
			send(ctx, body);
		},
		error(ctx: Context, error: Error) {
			return sendError(ctx, error, true);
		},
	};
} as Ctor.Responder);
