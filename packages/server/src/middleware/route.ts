import {asyncResult} from "@credo-js/utils";
import {throwError} from "./render";
import createHttpError from "http-errors";
import type {Context, Next} from "koa";
import type {Route} from "../types";

function isMethod(route: Route.Point, ctx: Context) {
	return route.methods.includes(ctx.method);
}

export const middleware = async function (ctx: Context, next: Next) {
	if(ctx.route || ctx.isBodyEnded) {
		return next();
	}

	const routes = ctx.credo.route.routeList;
	let methodContextError: Route.Context | null = null;

	for(const route of routes) {
		let match: any;

		try {
			match = await asyncResult(route.match(ctx));
		} catch(err) {
			if(!isMethod(route, ctx)) {
				methodContextError = route.context;
				continue;
			}
			if(createHttpError.isHttpError(err)) {
				return throwError(ctx, err, route.context, "ROUTE_MATCH_ERROR");
			}
			throw err;
		}

		if(match) {
			if(isMethod(route, ctx)) {
				ctx.route = route.context;
				Object.defineProperty(ctx, "match", { get() { return match; } });
				break;
			} else {
				methodContextError = route.context;
			}
		}
	}

	if(!ctx.route && methodContextError) {
		return throwError(ctx, createHttpError(400, `The ${ctx.method} method is not supported for this request.`), methodContextError, "HTTP_METHOD_NOT_SUPPORTED");
	}

	return next();
};

const def: any = {
	name: "routes",
	depth: -1,
	observer: false,
};

Object.keys(def).forEach(key => {
	Object.defineProperty(middleware, key, {
		get() {
			return def[key];
		},
		enumerable: true,
		configurable: false,
	});
});