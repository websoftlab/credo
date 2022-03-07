import {pathToPattern, matchPath} from "@credo-js/path-to-pattern";
import {asyncResult, callIn} from "@credo-js/utils";
import {throwError} from "./render";
import createHttpError from "http-errors";
import type {Context, Next} from "koa";
import type {Route, CredoJSGlobal} from "../types";
import type {PatternInterface} from "@credo-js/path-to-pattern";

type Nullable<T> = undefined | null | T;

const regUpperTest = /[^A-Z]/;
const regInvalid = /[^a-z0-9\-*.]/;
const regHostPort = /^(.+?):([0-9x*]+)$/;
const regHostCreate = /[.*]+/g;
const regPortCreate = /x|[*]+/g;
const regNRPC = /^(?:(.+?):)?(.+?)@(.+?)$/;

function createMatchCallback<Params extends { [K in keyof Params]?: string } = {}>(path: string): {
	pattern: PatternInterface<Params>,
	match: Route.PointMatch<Params>,
} {
	path = String(path).trim();
	if(path.length === 0 || !path.startsWith("/")) {
		path = `/${path}`;
	}
	const pattern = pathToPattern<Params>(path, {cacheable: true});
	const match = (ctx: Context) => pattern.match(ctx.path);
	return {
		pattern,
		match,
	};
}

function createPathCallback(path: Nullable<Route.Path>): { pattern?: PatternInterface, match: Route.PointMatch } {
	if(!path) {
		return createMatchCallback("/");
	} else if(Array.isArray(path)) {
		const [p, test] = path;
		const find = createMatchCallback(p);
		return {
			pattern: find.pattern,
			match: async (ctx: Context) => {
				const match = find.match(ctx);
				if(!match) {
					return false;
				}
				if(typeof test === "string") {
					if(await asyncResult(callIn(ctx.credo.services, test, [ctx, match], () => {
						throw new Error(`The "${test}" service is not defined`);
					}))) {
						return match;
					}
				} else if(typeof test === "function") {
					if(await asyncResult(test(ctx, match))) {
						return match;
					}
				} else {
					throw new Error("Math path parameter must be string or function");
				}
				return false;
			}
		};
	} else if(typeof path === "function") {
		const getPath = path;
		return {
			match: async (ctx: Context) => {
				const path: any = await asyncResult(getPath(ctx));
				if(typeof path === "string") {
					return matchPath(path, ctx.path);
				} else if(typeof path === "object" && path != null) {
					return path;
				} else {
					return false;
				}
			}
		};
	} else {
		return createMatchCallback(path);
	}
}

function createMethods(method: Nullable<Route.Method>): string[] {
	if(!method) {
		return ["GET"];
	}
	if(!Array.isArray(method)) {
		method = [method];
	}
	const support: string[] = [];
	method.forEach(val => {
		val = String(val).trim().toUpperCase();
		if(val.length > 0 && !regUpperTest.test(val) && !support.includes(val)) {
			support.push(val);
		}
	});
	return support;
}

function createMiddleware(middleware?: Route.ExtraMiddlewareType[], format: Route.ExtraMiddleware[] = []): Route.ExtraMiddleware[] {
	format = Array.isArray(format) ? format.slice().map(item => Object.create(item)) : [];
	if(!Array.isArray(middleware)) {
		return format;
	}
	const remove = (name: string) => {
		const index = format.findIndex(mw => mw.name === name);
		if (index !== -1) {
			format.splice(index, 1);
		}
	};
	middleware.forEach(item => {
		let name = item;
		let props: any;
		if(Array.isArray(item)) {
			// remove parent middleware
			if(name[0] == null) {
				return remove(String(name[1]));
			}
			props = name[1];
			name = name[0];
		}
		if(typeof name !== "string") {
			throw new Error("Extra middleware name must be string");
		}
		name = name.trim();
		if(!name.length) {
			throw new Error("Extra middleware name cannot be empty");
		}
		const index = format.findIndex(mw => mw.name === name);
		const mware = {
			name, props,
		};
		if (index === -1) {
			format.push(mware);
		} else {
			format.splice(index, 1, mware);
		}
	});
	return format;
}

function createResponder(responder?: string | [string, any]) {
	if(!responder) {
		throw new Error("The responder argument required for route");
	}
	if(Array.isArray(responder)) {
		const [name, props] = responder;
		return {
			name, props,
		};
	} else {
		return {
			name: responder
		};
	}
}

function createController(controller?: Route.Controller) {
	if(!controller) {
		throw new Error("The controller argument required for route");
	}
	if(typeof controller === "string") {
		return {
			name: controller,
		};
	} else if(Array.isArray(controller)) {
		const [name, props = {}] = controller;
		return {
			name, props,
		};
	} else if(typeof controller === "function") {
		return {
			name: controller.name || Symbol(),
			handler: controller,
		};
	} else {
		throw new Error("Invalid controller type");
	}
}

function createCacheConfig(cache: Nullable<Route.Cache>) {
	const c: Route.CacheOptions = {
		mode: "body",
		ttl: 3600,
		cacheable: (ctx: Context) => ctx.method === "GET" && ctx.is('html') === "html",
		getKey: (ctx: Context) => ctx.path,
	};

	if(cache == null) {
		return c;
	}

	// true | false
	if(typeof cache === "boolean") {
		c.cacheable = () => cache;
	} else if(typeof cache === "number") {
		c.ttl = cache;
	} else if(typeof cache === "string") {
		c.mode = cache === "controller" ? "controller" : "body";
	} else if(typeof cache === "object") {
		if(cache.mode === "controller") {
			c.mode = "controller";
		}
		if(typeof cache.ttl === "number") {
			c.ttl = cache.ttl;
		}
		if(typeof cache.cacheable === "function") {
			c.cacheable = cache.cacheable;
		}
		if(typeof cache.getKey === "function") {
			c.getKey = cache.getKey;
		}
	}

	return c;
}

function createRegHost(prop: { host: string, port: string }) {
	const {host, port} = prop;
	return new RegExp("^" + (
		host.replace(regHostCreate, (val => {
			if(val === ".") return "\\.";
			if(val.length > 1) return "(?:.+?)";
			return "(?:[^.]+)";
		})) + ":" + (
			port === "*" ? "\\d+" : port.replace(regPortCreate, (val => {
				if(val === "x") return '\\d';
				return '\\d*';
			}))
		)
	) + "$")
}

type LoadRoutesType = {
	baseUrl: string,
	getQueryId: string,
	isHost: (ctx: Context) => boolean,
	routes: Route.Point[],
	route404?: Route.EmptyPoint,
};

export function loadRoutes(credo: CredoJSGlobal): LoadRoutesType {
	const conf = credo.config("routes");
	const {
		baseUrl = "/",
		getQueryId = "query",
		host = "*",
		routes = [],
		route404,
		middleware,
		... otherConf
	} = conf;

	let hostAll = false;
	const hosts = (Array.isArray(host) ? host : [host])
		.map(host => {
			let port = "*";
			host = String(host).trim().toLowerCase();
			const match = host.match(regHostPort);
			if(match) {
				port = match[2];
				host = match[1];
			}
			if(regInvalid.test(host)) {
				return null;
			}
			if(host === "*" && port === "*") {
				hostAll = true;
				return null;
			}
			return {host, port};
		})
		.filter(host => host !== null) as ({host: string, port: string}[]);

	if(!hosts.length) {
		hostAll = true;
	}

	const hostReg: RegExp[] = hostAll ? [] : hosts.map(createRegHost);

	const isHost = (ctx: Context) => {
		if(hostAll) {
			return true;
		}
		let host = String(ctx.hostname).trim().toLowerCase();
		if(!host.length) {
			return false;
		}
		if(!host.includes(":")) {
			host += `:${ctx.secure ? "443" : "80"}`;
		}
		return hostReg.some(reg => reg.test(host));
	};

	const parent = {... otherConf, middleware: createMiddleware(middleware)};
	const load: LoadRoutesType = {
		baseUrl,
		getQueryId,
		isHost,
		routes: configRoute(routes, [], parent),
	};

	const load404 = configEmptyRoute(route404, parent);
	if(load404) {
		load.route404 = load404;
	}

	return load;
}

class NameGen {
	private iter: number = 1;
	gen() {
		return `route-key-${this.iter++}`;
	}
}

const nameGen = new NameGen();

function getNRPC(nrpc: Route.NRPCType, parentResponder?: string): Route.NRPCDecode {

	let rProps: any = null;
	let cProps: any = null;
	let details: any = null;
	if(Array.isArray(nrpc)) {
		if(nrpc[1] != null) rProps = nrpc[1];
		if(nrpc[2] != null) cProps = nrpc[2];
		if(nrpc[3] != null) details = nrpc[3];
		nrpc = String(nrpc[0]);
	}

	if(parentResponder && !nrpc.includes("@")) {
		if(nrpc.includes("|")) {
			nrpc = nrpc.replace("|", `@${parentResponder}|`);
		} else {
			nrpc += `@${parentResponder}`;
		}
	}

	const found = nrpc.match(regNRPC);
	if(!found) {
		throw new Error(`Invalid "nrpc" argument ${nrpc}`);
	}

	const segments = found[3].trim().split("|").map(line => line.trim());
	const name = found[2].trim();
	const method: string[] = found[1] ? found[1].trim().split(",").map(line => line.trim()) : [];
	const responder = segments[0];
	const controller = segments[2] || name;

	const route: Route.NRPCDecode = {
		name,
		responder: rProps != null ? [responder, rProps] : responder,
		path: "/" + trimLeftSegment(segments[1] || name),
		controller: cProps != null ? [controller, cProps] : controller,
	};

	if(method.length) {
		route.method = method;
	}

	if(details != null) {
		route.details = details;
	}

	return route;
}

function trimLeftSegment(segment: string) {
	segment = segment.trim();
	while(segment.startsWith("/")) {
		segment = segment.substring(1);
	}
	return segment;
}

function trimRightSegment(segment: string) {
	segment = segment.trim();
	while(segment.endsWith("/")) {
		segment = segment.slice(0, -1);
	}
	return segment;
}

function normalizeRoute(route: Route.Route | Route.EmptyRoute, responder?: string) {
	if(typeof route === "string" || Array.isArray(route)) {
		route = {
			nrpc: route,
		};
	}
	if("nrpc" in route) {
		const {nrpc, details, ... other} = route;
		const decode = getNRPC(nrpc, responder);
		route = {
			... decode,
			... other,
		};
		if(details != null) {
			route.details = {
				... route.details,
				... details
			};
		}
	}
	return route;
}

function configEmptyRoute(route?: Route.EmptyRoute, parent: any = {}): null | Route.EmptyPoint {
	if(!route) {
		return null;
	}

	route = normalizeRoute(route, parent.responder);
	let {
		name,
		controller,
		method,
		responder,
		details,
		middleware,
		cache,
	} = route;

	if(!name) {
		name = nameGen.gen();
	}
	if(parent.name) {
		name = `${parent.name}.${name}`;
	}

	if(parent.controller) {
		if(controller) {
			if(typeof controller !== "string") {
				throw new Error("Route children controller must be string");
			}
			controller = `${parent.controller}.${controller}`;
		} else {
			controller = parent.controller;
		}
	}

	if(parent.method && !method) {
		method = parent.method;
	}

	if(parent.responder && !responder) {
		responder = parent.responder;
	}

	const methods = createMethods(method);
	return {
		methods,
		context: {
			name,
			cache: createCacheConfig(cache),
			responder: createResponder(responder),
			controller: createController(controller),
			middleware: createMiddleware(middleware, parent.middleware),
			details: {
				notFound: true,
				... details,
			},
		},
	};
}

function configRoute(configRoutes: Route.Route[], contextRoutes: Route.Point[] = [], parent: any = {}): Route.Point[] {
	configRoutes.forEach(route => {
		route = normalizeRoute(route, parent.responder);
		let {
			name,
			path,
			controller,
			method,
			responder,
			details,
			cache,
			middleware,
			... otherRoute
		} = route;

		if(!name) {
			name = nameGen.gen();
		}

		if(parent.name) {
			name = `${parent.name}.${name}`;
		}

		if(parent.path) {
			if(path) {
				if(typeof path !== "string") {
					throw new Error("Route children path must be string");
				}
				path = trimLeftSegment(path);
				if(path.length) {
					path = trimRightSegment(parent.path) + "/" + path;
				} else {
					path = parent.path;
				}
			} else {
				path = parent.path;
			}
		}

		if(parent.controller) {
			if(controller) {
				if(typeof controller !== "string") {
					throw new Error("Route children controller must be string");
				}
				controller = `${parent.controller}.${controller}`;
			} else {
				controller = parent.controller;
			}
		}

		if(parent.method && !method) {
			method = parent.method;
		}

		if(parent.responder && !responder) {
			responder = parent.responder;
		}

		if("routes" in otherRoute && Array.isArray(otherRoute.routes)) {
			configRoute(otherRoute.routes, contextRoutes, {
				name,
				path,
				controller,
				responder,
				method,
				middleware: createMiddleware(middleware, parent.middleware),
				cache: cache == null ? parent.cache : cache,
				details: {
					... parent.details,
					... details,
				},
			});
		} else {
			const methods = createMethods(method);
			contextRoutes.push({
				... createPathCallback(path),
				methods,
				context: {
					name,
					cache: createCacheConfig(cache),
					responder: createResponder(responder),
					controller: createController(controller),
					middleware: createMiddleware(middleware, parent.middleware),
					details: {
						... parent.details,
						... details,
					},
				},
			});
		}
	});
	return contextRoutes;
}

function isMethod(route: Route.Point, ctx: Context) {
	return route.methods.includes(ctx.method);
}

export const middleware = async function (ctx: Context, next: Next) {
	if(ctx.route || ctx.res.writableEnded) {
		return next();
	}

	const routes = ctx.credo.routes || [];
	let methodContextError: Route.Context | null = null;

	for(let i = 0; i < routes.length; i++) {
		const route = routes[i];
		let match: any;

		try {
			match = await asyncResult(route.match(ctx));
		} catch(err) {
			if(!isMethod(route, ctx)) {
				methodContextError = route.context;
				continue;
			}
			if(createHttpError.isHttpError(err)) {
				return throwError(ctx, err, route.context);
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
		return throwError(ctx, createHttpError(400, `The ${ctx.method} method is not supported for this request.`), methodContextError);
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