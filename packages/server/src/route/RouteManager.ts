import type { PhragonJS, Route, RouteConfig } from "../types";
import type { Context } from "koa";
import type { PatternInterface } from "@phragon/path-to-pattern";
import type { Nullable } from "../helpTypes";
import type { RouteVariant, NRCPDecode, NRCPDecodeType, NormalizeRoute } from "./types";
import type { RootRouter } from "./Router";
import { pathToPattern, matchPath } from "@phragon/path-to-pattern";
import { toAsync } from "@phragon-util/async";
import { isPlainObject } from "@phragon-util/plain-object";
import { createMethods, nameGen, trimLeftSegment, trimRightSegment } from "./utils";
import { default as RouteEntity } from "./RouteEntity";
import { default as RoutePattern } from "./RoutePattern";
import { default as RouteEmpty } from "./RouteEmpty";
import { default as RouteGroup } from "./RouteGroup";
import { default as RouteDynamic } from "./RouteDynamic";
import { sortNative, sortPattern } from "./sort";

const regInvalid = /[^a-z0-9\-*.]/;
const regHostPort = /^(.+?):([0-9x*]+)$/;
const regHostCreate = /[.*]+/g;
const regPortCreate = /x|[*]+/g;

function createMatchCallback<Params extends { [K in keyof Params]?: string } = {}>(
	path: string
): {
	pattern: PatternInterface<Params>;
	match: (ctx: Context) => false | Params;
} {
	path = String(path).trim();
	if (path.length === 0 || !path.startsWith("/")) {
		path = `/${path}`;
	}
	const pattern = pathToPattern<Params>(path, { cacheable: true });
	const match = (ctx: Context) => pattern.match(ctx.path);
	return {
		pattern,
		match,
	};
}

function getService(phragon: PhragonJS, service: string) {
	const nodes = String(service).split(".");
	let target: any = phragon.services;
	let handler: any = target;

	do {
		const node = nodes.shift() as string;
		if (!handler.hasOwnProperty(node)) {
			throw new Error(`The '${service}' service not found`);
		}
		handler = handler[node];
		if (!handler) {
			throw new Error(`The '${service}' service is invalid`);
		}
		if (typeof handler === "object") {
			target = handler;
		}
	} while (nodes.length > 0);

	return {
		target,
		handler,
	};
}

function createDynamicPathOptions(phragon: PhragonJS, path: RouteConfig.PathDynamic) {
	let { matchToPath, match, service } = path;
	let length: number | (() => number) | undefined = undefined;

	if (service) {
		if (match)
			throw new Error(`You cannot use the 'service' and 'match' options at the same time for a group route.`);
		if (matchToPath)
			throw new Error(
				`You cannot use the 'service' and 'matchToPath' options at the same time for a group route.`
			);

		const { target, handler } = getService(phragon, service);

		if (typeof handler === "function") {
			match = (ctx: Context) => handler.call(target, ctx);
		} else {
			if (typeof handler.match !== "function") {
				throw new Error(`The ${service}.match() service function is not defined`);
			}
			match = (ctx: Context) => handler.match.call(target, ctx);
			if (typeof handler.matchToPath === "function") {
				matchToPath = (params: any, ctx) => handler.matchToPath.call(target, params, ctx);
			}
			const descriptor = Object.getOwnPropertyDescriptor(handler, "length");
			if (descriptor) {
				const { value, get } = descriptor;
				if (typeof value === "number") {
					length = descriptor.value;
				} else if (typeof get === "function") {
					length = () => {
						return get.call(handler);
					};
				}
			}
		}
	} else if (typeof match !== "function") {
		throw new Error(`The "match" or "service" option is required for dynamic route`);
	}

	return {
		match,
		matchToPath,
		length,
	};
}

function createPatternPathOptions(
	phragon: PhragonJS,
	path: RouteConfig.PathPattern | RouteConfig.PathHandler
): { pattern?: PatternInterface; match: Route.Match } {
	if (path.type === "pattern") {
		return createMatchCallback(path.pattern);
	}

	const { type } = path;
	if (path.type !== "handler") {
		throw new Error(`Invalid path type ${type}`);
	}

	let { pattern, handler } = path;
	let test: Function;

	if (typeof handler === "function") {
		test = handler;
	} else {
		const { handler: callback, target } = getService(phragon, handler);
		if (typeof callback !== "function") {
			throw new Error(`The "${handler}" service is not a function`);
		}
		test = (ctx: Context, match?: any) => callback.call(target, ctx, match);
	}

	if (pattern) {
		const find = createMatchCallback(pattern);
		return {
			pattern: find.pattern,
			async match(ctx: Context) {
				const match = find.match(ctx);
				if (!match) {
					return false;
				} else if (await toAsync(test(ctx, match))) {
					return match;
				}
			},
		};
	}

	return {
		async match(ctx: Context) {
			const match = await toAsync(test(ctx));
			if (typeof match === "string") {
				return matchPath(match, ctx.path);
			} else if (typeof path === "object" && path != null) {
				return path;
			} else if (match === true) {
				return {};
			} else {
				return false;
			}
		},
	};
}

function createMiddleware(
	middleware?: RouteConfig.ExtraMiddlewareType[],
	format: Route.ExtraMiddleware[] = []
): Route.ExtraMiddleware[] {
	format = Array.isArray(format) ? format.slice().map((item) => Object.create(item)) : [];
	if (!Array.isArray(middleware)) {
		return format;
	}
	const remove = (name: string) => {
		const index = format.findIndex((mw) => mw.name === name);
		if (index !== -1) {
			format.splice(index, 1);
		}
	};
	middleware.forEach((item) => {
		let name = item;
		let props: any;
		if (Array.isArray(item)) {
			// remove parent middleware
			if (name[0] == null) {
				return remove(String(name[1]));
			}
			props = name[1];
			name = name[0];
		}
		if (typeof name !== "string") {
			throw new Error("Extra middleware name must be string");
		}
		name = name.trim();
		if (!name.length) {
			throw new Error("Extra middleware name cannot be empty");
		}
		const index = format.findIndex((mw) => mw.name === name);
		const mware = {
			name,
			props,
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
	if (!responder) {
		throw new Error("The responder argument required for route");
	}
	if (Array.isArray(responder)) {
		const [name, props] = responder;
		return {
			name,
			props,
		};
	} else {
		return {
			name: responder,
		};
	}
}

function createController(controller?: RouteConfig.Controller) {
	if (!controller) {
		throw new Error("The controller argument required for route");
	}
	if (typeof controller === "string") {
		return {
			name: controller,
		};
	} else if (Array.isArray(controller)) {
		const [name, props = {}] = controller;
		return {
			name,
			props,
		};
	} else if (typeof controller === "function") {
		return {
			name: controller.name || Symbol(),
			handler: controller,
		};
	} else {
		throw new Error("Invalid controller type");
	}
}

function createCacheConfig(cache: Nullable<RouteConfig.Cache>) {
	const c: Route.CacheOptions = {
		mode: "body",
		ttl: 3600,
		cacheable: (ctx: Context) => ctx.method === "GET" && ctx.is("html") === "html",
		getKey: (ctx: Context) => ctx.path,
	};

	if (cache == null) {
		return c;
	}

	// true | false
	if (typeof cache === "boolean") {
		c.cacheable = () => cache;
	} else if (typeof cache === "number") {
		c.ttl = cache;
	} else if (typeof cache === "string") {
		c.mode = cache === "controller" ? "controller" : "body";
	} else if (typeof cache === "object") {
		if (cache.mode === "controller") {
			c.mode = "controller";
		}
		if (typeof cache.ttl === "number") {
			c.ttl = cache.ttl;
		}
		if (typeof cache.cacheable === "function") {
			c.cacheable = cache.cacheable;
		}
		if (typeof cache.getKey === "function") {
			c.getKey = cache.getKey;
		}
	}

	return c;
}

function createHostRegExp(prop: [string, string]) {
	const [host, port] = prop;
	return new RegExp(
		"^" +
			(host.replace(regHostCreate, (val) => {
				if (val === ".") return "\\.";
				if (val.length > 1) return "(?:.+?)";
				return "(?:[^.]+)";
			}) +
				":" +
				(port === "*"
					? "\\d+"
					: port.replace(regPortCreate, (val) => {
							if (val === "x") return "\\d";
							return "\\d*";
					  }))) +
			"$"
	);
}

function createHostListRegExp(host: string | string[]): RegExp[] {
	if (!Array.isArray(host)) {
		host = [host];
	}

	const hostList: [string, string][] = [];
	const all = host.some((host) => {
		let port = "*";
		host = String(host).trim().toLowerCase();
		const match = host.match(regHostPort);
		if (match) {
			port = match[2];
			host = match[1];
		}
		if (regInvalid.test(host)) {
			return false;
		}
		if (host === "*" && port === "*") {
			return true;
		}
		hostList.push([host, port]);
	});

	if (all || !host.length) {
		return [];
	}

	return hostList.map(createHostRegExp);
}

function verifyRouterName(name: string) {
	if (/[^A-Za-z0-9_\-.$]/.test(name)) {
		throw new Error(`Invalid router name ${name}`);
	}
}

function decodeNRCP(name: string): NRCPDecodeType {
	name = String(name || "");

	let responder: null | false | string = null;
	let controller: null | false | string = null;
	let path: null | false | string = null;
	let method: string[] = [];

	// find method
	let match = name.match(/^([a-z, ]+):/i);
	if (match) {
		method = match[1]
			.toUpperCase()
			.split(",")
			.map((value) => value.trim())
			.filter((item) => item.length > 0);
		name = name.substring(match[0].length);
	}

	// find path
	let index = name.indexOf("/");
	if (index !== -1) {
		path = name.substring(index);
		name = name.substring(0, index);
		if (path === "") {
			path = false;
		}
	}

	// find responder
	index = name.indexOf("@");
	if (index !== -1) {
		const prev = name.indexOf("[", index);
		if (prev === -1) {
			responder = name.substring(index + 1);
			name = name.substring(0, index);
		} else {
			responder = name.substring(index + 1, prev);
			name = name.substring(0, index) + name.substring(prev);
		}
		responder = responder.trim();
		if (responder === "") {
			responder = false;
		}
	}

	// controller
	match = name.match(/\[(.*?)]$/);
	if (match) {
		controller = match[1].trim();
		name = name.substring(0, name.length - match[0].length);
		if (controller === "") {
			controller = false;
		}
	}

	name = name.trim();
	if (name.length === 0) {
		throw new Error("NRCP name option is required");
	}

	verifyRouterName(name);

	if (path === null) path = name;
	if (controller === null) controller = name;
	if (responder === null) responder = name;

	const options: NRCPDecodeType = { name };

	if (method.length > 0) {
		options.method = method;
	}

	if (path !== false) {
		path = path.replace(/[.\/]+/g, "/");
		if (!path.startsWith("/")) {
			path = `/${path}`;
		}
		options.path = path;
	}

	if (responder !== false) options.responder = responder;
	if (controller !== false) options.controller = controller;

	return options;
}

export function getNRCP(nrcp: RouteConfig.NRCPType, parentResponder?: string): NRCPDecode {
	let rProps: any = null;
	let cProps: any = null;
	let details: any = null;

	if (Array.isArray(nrcp)) {
		if (nrcp[1] != null) rProps = nrcp[1];
		if (nrcp[2] != null) cProps = nrcp[2];
		if (nrcp[3] != null) details = nrcp[3];
		nrcp = String(nrcp[0]);
	}

	const decode = decodeNRCP(nrcp);
	if (parentResponder && !decode.responder) {
		decode.responder = parentResponder;
	}

	const { controller, responder, ...rest } = decode;
	const route: NRCPDecode = rest;

	if (controller) {
		route.controller = isPlainObject(cProps) ? [controller, cProps] : controller;
	}
	if (responder) {
		route.responder = isPlainObject(rProps) ? [responder, rProps] : responder;
	}
	if (isPlainObject(details)) {
		route.details = details;
	}

	return route;
}

function normalizeRoute(route: RouteConfig.Route | RouteConfig.EmptyRoute, parent: any): NormalizeRoute {
	if (typeof route === "string" || Array.isArray(route)) {
		route = {
			nrcp: route,
		};
	}

	if ("nrcp" in route) {
		const { nrcp, details, ...other } = route;
		const decode = getNRCP(nrcp, parent.responder);
		route = {
			...decode,
			...other,
		};
		if (details != null) {
			route.details = {
				...route.details,
				...details,
			};
		}
	}

	let { controller, method, responder, name, ...restRoute } = route;
	let _originName = "";

	if (!name) {
		name = nameGen.gen();
	} else {
		verifyRouterName(name);
		_originName = name;
	}
	if (parent.name) {
		name = `${parent.name}.${name}`;
		_originName = _originName ? name : parent.name;
	}

	if (parent.controller) {
		if (controller) {
			if (typeof controller !== "string") {
				throw new Error("Route children controller must be string");
			}
			controller = `${parent.controller}.${controller}`;
		} else {
			controller = parent.controller;
		}
	}

	if (parent.method && !method) {
		method = parent.method;
	}

	if (parent.responder && !responder) {
		responder = parent.responder;
	}

	return {
		...restRoute,
		name,
		controller,
		method,
		responder,
		_originName,
	};
}

function configEmptyRoute(route: RouteConfig.EmptyRoute, parent: any = {}): Route.RouteEmpty {
	const { name, controller, method, responder, details, middleware, cache } = normalizeRoute(route, parent);

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
				...details,
			},
		},
	};
}

function configRoute(
	phragon: PhragonJS,
	configRoutes: RouteConfig.Route[],
	parent: any,
	callback: (r: RouteVariant, g?: RouteGroup) => void,
	group?: RouteGroup
): void {
	for (let route of configRoutes) {
		let { name, path, controller, method, responder, details, cache, middleware, _originName, ...otherRoute } =
			normalizeRoute(route, parent);

		if (parent.path) {
			if (path) {
				if (typeof path !== "string") {
					throw new Error("Route children path must be string");
				}
				path = trimLeftSegment(path);
				if (path.length) {
					path = trimRightSegment(parent.path) + "/" + path;
				} else {
					path = parent.path;
				}
			} else {
				path = parent.path;
			}
		}

		const createParent = () => ({
			name: _originName,
			path,
			controller,
			responder,
			method,
			middleware: createMiddleware(middleware, parent.middleware),
			cache: cache == null ? parent.cache : cache,
			details: {
				...parent.details,
				...details,
			},
		});

		if (otherRoute.group) {
			if (typeof path !== "string") {
				throw new Error(`'${name}' group route path must be a string`);
			}
			let routes: RouteConfig.Route[] = [];
			if ("routes" in otherRoute && Array.isArray(otherRoute.routes) && otherRoute.routes.length > 0) {
				routes = otherRoute.routes;
			} else {
				phragon.debug.error(`Attention! The routes group route option '${name}' is empty`);
			}
			const routeGroup = new RouteGroup(path, method);
			callback(routeGroup, group);
			if (routes.length > 0) {
				configRoute(phragon, routes, createParent(), callback, routeGroup);
			}
			continue;
		}

		if ("routes" in otherRoute) {
			const { routes } = otherRoute;
			if (Array.isArray(routes) && routes.length > 0) {
				configRoute(phragon, routes, createParent(), callback, group);
			}
			continue;
		}

		if (!path) {
			path = "/";
		}

		if (typeof path === "string") {
			path = {
				type: "pattern",
				pattern: path,
			};
		}

		const methods = createMethods(method);
		const context: Route.Context = {
			name,
			cache: createCacheConfig(cache),
			responder: createResponder(responder),
			controller: createController(controller),
			middleware: createMiddleware(middleware, parent.middleware),
			details: {
				...parent.details,
				...details,
			},
		};

		// RoutePattern
		if (path.type === "dynamic") {
			callback(
				new RouteDynamic({
					...createDynamicPathOptions(phragon, path),
					methods,
					context,
				}),
				group
			);
		} else {
			callback(
				new RoutePattern({
					...createPatternPathOptions(phragon, path),
					methods,
					context,
				}),
				group
			);
		}
	}
}

const ADD_ROUTE_KEY = Symbol();

export default class RouteManager {
	private readonly _hostList: RegExp[] = [];
	private readonly _nameToRoute: Record<string, RoutePattern | RouteDynamic> = {};
	private _sorted: boolean = false;
	private _routeList: RouteVariant[] = [];
	private _init: boolean = false;
	private _routeNotFound: RouteEmpty | null = null;

	[ADD_ROUTE_KEY] = (route: RouteVariant, priority?: number, group?: RouteGroup) => {
		route.index = this._routeList.length;
		if (typeof priority === "number") {
			route.priority = priority;
		}
		Object.freeze(route);

		if (group) {
			group.routes.push(route);
		} else {
			this._routeList.push(route);
		}

		if (RouteEntity.isRouteGroup(route)) {
			return;
		}

		const { name } = route;
		if (this.added(name)) {
			this.phragon.debug.error("Duplicate route name {cyan %s}", name);
		} else {
			this._nameToRoute[name] = route;
		}
	};

	constructor(public phragon: PhragonJS, rootRouter?: RootRouter) {
		const freezeRoutes = (routes: RouteVariant[]) => {
			Object.freeze(routes);
			for (const route of routes) {
				if (RouteEntity.isRouteGroup(route)) {
					freezeRoutes(route.routes);
				}
			}
		};

		const init = () => {
			this._init = true;

			Object.freeze(this);
			Object.freeze(this._nameToRoute);
			Object.freeze(this._hostList);

			freezeRoutes(this._routeList);

			return this;
		};

		if (!phragon.isApp()) {
			return init();
		}

		// todo - deprecated phragon.config(...), use only rootRouter
		const conf = rootRouter ? rootRouter.toConfigObject() : phragon.config("routes");
		const { host = "*", routes = [], route404, sort = "native", middleware, ...otherConf } = conf;

		this._hostList = createHostListRegExp(host);

		configRoute(phragon, routes, { ...otherConf, middleware }, (route, group) => {
			this[ADD_ROUTE_KEY](route, undefined, group);
		});

		if (route404) {
			this._routeNotFound = new RouteEmpty(configEmptyRoute(route404, otherConf));
		}

		phragon.hooks.once("onBoot", () => {
			if (!this._sorted) {
				this.sort(sort);
			}
			init();
		});
	}

	isHost(ctx: Context): boolean {
		if (this._hostList.length === 0) {
			return true;
		}
		let host = String(ctx.hostname).trim().toLowerCase();
		if (!host.length) {
			return false;
		}
		if (!host.includes(":")) {
			host += `:${ctx.secure ? "443" : "80"}`;
		}
		return this._hostList.some((reg) => reg.test(host));
	}

	isNotFoundRoute(): this is { routeNotFound: RouteEmpty } {
		return this._routeNotFound != null;
	}

	get names(): string[] {
		return Object.keys(this._nameToRoute);
	}

	get routeLength(): number {
		return this._routeList.length;
	}

	get nestedRouteLength(): number {
		return this._routeList.reduce(
			(calc, route) => calc + (RouteEntity.isRouteGroup(route) ? route.nestedRouteLength : 1),
			0
		);
	}

	get routeList() {
		return this._routeList;
	}

	get routeNotFound() {
		return this._routeNotFound;
	}

	addRoute(route: RouteVariant | RouteConfig.Route, priority?: number) {
		if (this._init) {
			return this;
		}

		if (RouteEntity.isRoute(route)) {
			this[ADD_ROUTE_KEY](route, priority);
			return this;
		}

		configRoute(this.phragon, [route], { middleware: [] }, (route, group) => {
			this[ADD_ROUTE_KEY](route, priority, group);
		});

		return this;
	}

	addNotFoundRoute(route: RouteEmpty | RouteConfig.EmptyRoute) {
		if (this._init) {
			return this;
		}
		if (RouteEntity.isRouteEmpty(route)) {
			this._routeNotFound = route;
		} else {
			this._routeNotFound = new RouteEmpty(configEmptyRoute(route));
		}
		return this;
	}

	remove(route: RouteVariant) {
		if (this._init) {
			return this;
		}

		function del(routes: RouteVariant[]) {
			for (let i = 0; i < routes.length; i++) {
				const item = routes[i];
				if (item === route) {
					routes.splice(i, 1);
					return true;
				}
				if (RouteEntity.isRouteGroup(item) && del(item.routes)) {
					return true;
				}
			}
			return false;
		}

		del(this._routeList);

		if (!RouteEntity.isRouteGroup(route)) {
			const name = route.name;
			if (this._nameToRoute.hasOwnProperty(name)) {
				delete this._nameToRoute[name];
			}
		}

		return this;
	}

	added(name: string) {
		return this._nameToRoute.hasOwnProperty(name);
	}

	route(name: string) {
		return this.added(name) ? this._nameToRoute[name] : null;
	}

	pattern(name: string) {
		if (!this.added(name)) {
			return null;
		}
		const route = this._nameToRoute[name];
		if (RouteEntity.isRoutePattern(route)) {
			return route.pattern || null;
		}
		return null;
	}

	async matchToPath(name: string, match: any, ctx: Context): Promise<string> {
		if (!this.added(name)) {
			throw new Error(`The ${name} route not found`);
		}
		const route = this._nameToRoute[name];
		if (RouteEntity.isRoutePattern(route)) {
			const pattern = route.pattern;
			if (!pattern) {
				throw new Error(`The pattern's of ${name} route not found`);
			}
			return pattern.matchToPath({ data: match });
		}
		if (!route.matchToPath) {
			throw new Error(`The ${name} matchToPath route not defined`);
		}
		return route.matchToPath(match, ctx);
	}

	sort(type: "native" | "pattern" | ((a: RouteVariant, b: RouteVariant) => number)) {
		if (this._init) {
			return this;
		}
		this._sorted = true;
		if (typeof type === "function") {
			this._routeList.sort(type);
		} else if (type === "pattern") {
			this._routeList.sort(sortPattern);
		} else if (type === "native") {
			this._routeList.sort(sortNative);
		}
		return this;
	}
}
