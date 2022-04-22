import { asyncResult } from "@credo-js/utils";
import { throwError } from "./render";
import createHttpError from "http-errors";
import { RouteEntity } from "../route";
import type { Context, Next } from "koa";
import type { Route } from "../types";
import type { RouteVariant } from "../route/types";

type ContextRef = {
	context?: Route.Context;
	message?: string;
	code?: string;
};

async function find(ctx: Context, ref: ContextRef, routes: RouteVariant[]): Promise<void> {
	for (const route of routes) {
		if (RouteEntity.isRouteGroup(route)) {
			if (route.match(ctx)) {
				return find(ctx, ref, route.routes);
			}
			continue;
		}

		let match: any;

		try {
			match = await asyncResult(route.match(ctx));
		} catch (err) {
			if (!route.method(ctx.method)) {
				ref.context = route.context;
				ref.code = "ROUTE_MATCH_ERROR";
				continue;
			}
			if (createHttpError.isHttpError(err)) {
				return throwError(ctx, err, route.context, "ROUTE_MATCH_ERROR");
			}
			throw err;
		}

		if (match) {
			if (route.method(ctx.method)) {
				ctx.route = route.context;
				ctx.match = match;
				return;
			} else {
				ref.context = route.context;
				ref.message = `The ${ctx.method} method is not supported for this request.`;
				ref.code = "HTTP_METHOD_NOT_SUPPORTED";
			}
		}
	}
}

export const middleware = async function (ctx: Context, next: Next) {
	if (ctx.route || ctx.isBodyEnded) {
		return next();
	}

	const ref: ContextRef = {};

	await find(ctx, ref, ctx.credo.route.routeList);

	if (!ctx.route && ref.context) {
		return throwError(ctx, createHttpError(400, ref.message || `Route query error`), ref.context, ref.code);
	}

	return next();
};

const def: any = {
	name: "routes",
	depth: -1,
	observer: false,
};

Object.keys(def).forEach((key) => {
	Object.defineProperty(middleware, key, {
		get() {
			return def[key];
		},
		enumerable: true,
		configurable: false,
	});
});
