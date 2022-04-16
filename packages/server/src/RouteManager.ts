import type {CredoJS, Route} from "./types";
import type {Context} from "koa";
import type {PatternInterface} from "@credo-js/path-to-pattern";
import {pathToPattern, matchPath} from "@credo-js/path-to-pattern";
import {asyncResult, callIn} from "@credo-js/utils";

type Nullable<T> = undefined | null | T;

class NameGen {
	private iter: number = 1;
	gen() {
		return `route-key-${this.iter++}`;
	}
}

const nameGen = new NameGen();

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

function createHostRegExp(prop: [string, string]) {
	const [host, port] = prop;
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

function createHostListRegExp(host: string | string[]): RegExp[] {

	if(!Array.isArray(host)) {
		host = [host];
	}

	const hostList: [string, string][] = [];
	const all = host.some(host => {
		let port = "*";
		host = String(host).trim().toLowerCase();
		const match = host.match(regHostPort);
		if(match) {
			port = match[2];
			host = match[1];
		}
		if(regInvalid.test(host)) {
			return false;
		}
		if(host === "*" && port === "*") {
			return true;
		}
		hostList.push([host, port]);
	});

	if(all || !host.length) {
		return [];
	}

	return hostList.map(createHostRegExp);

}

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

type NormalizeRoute = {
	cache?: Route.Cache;
	details?: any;
	middleware?: Route.ExtraMiddlewareType[];
	routes?: Route.Route[];
	method?: Route.Method;
	name: string;
	responder?: string | [string, any];
	path?: Route.Path;
	controller: Route.Controller;
};

function normalizeRoute(route: Route.Route | Route.EmptyRoute, parent: any): NormalizeRoute {
	if(typeof route === "string" || Array.isArray(route)) {
		route = {
			nrpc: route,
		};
	}

	if("nrpc" in route) {
		const {nrpc, details, ... other} = route;
		const decode = getNRPC(nrpc, parent.responder);
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

	let {
		controller,
		method,
		responder,
		name,
		... restRoute
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

	return {
		... restRoute,
		name,
		controller,
		method,
		responder,
	};
}

function configEmptyRoute(route: Route.EmptyRoute, parent: any = {}): Route.EmptyPoint {

	const {
		name,
		controller,
		method,
		responder,
		details,
		middleware,
		cache,
	} = normalizeRoute(route, parent);

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

function configRoute(configRoutes: Route.Route[] = [], parent: any = {}, callback: (point: RoutePoint) => void): void {

	for(let route of configRoutes) {
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
		} = normalizeRoute(route, parent);

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

		if("routes" in otherRoute && Array.isArray(otherRoute.routes)) {
			return configRoute(otherRoute.routes, {
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
			}, callback);
		}

		const methods = createMethods(method);
		const rt = new RoutePoint({
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
		callback(rt);
	}
}

function sortPattern(a: RoutePoint, b: RoutePoint) {
	let bl = b.pattern ? b.pattern.length : -1;
	let al = a.pattern ? a.pattern.length : -1;
	if(b.pattern && a.pattern) {
		if(al !== bl) {
			return bl - al;
		}
		let aNoKeys = a.pattern.keys.length === 0;
		if(b.pattern.keys.length === 0) {
			if(aNoKeys) {
				return 1;
			}
		} else if(aNoKeys) {
			return - 1;
		}
		return b.priority - a.priority;
	}
	if(bl === al) {
		return b.priority - a.priority;
	} else {
		return bl - al;
	}
}

function sortNative(a: RoutePoint, b: RoutePoint) {
	return a.priority === b.priority ? 0 : b.priority - a.priority;
}

class RouteWithoutMatch implements Route.EmptyPoint {

	name: string;
	context: Route.Context;
	methods: string[];

	constructor(point: Route.EmptyPoint) {
		this.name = point.context.name;
		this.context = point.context;
		this.methods = point.methods;
	}

	method(method: string): boolean {
		return this.methods.includes(method);
	}
}

export class RouteEmptyPoint extends RouteWithoutMatch {}

export class RoutePoint extends RouteWithoutMatch implements Route.Point {
	index: number = 0;
	priority: number = 1;
	match: Route.PointMatch;
	pattern?: PatternInterface;

	constructor({match, pattern, ... rest}: Route.Point) {
		super(rest);
		this.match = match;
		this.pattern = pattern;
	}
}

const ADD_ROUTE_KEY = Symbol();

export class RouteManager {

	private readonly _hostList: RegExp[] = [];
	private readonly _nameToRoute: Record<string, RoutePoint> = {};
	private _sorted: boolean = false;
	private _routeList: RoutePoint[] = [];
	private _init: boolean = false;
	private _routeNotFound: RouteEmptyPoint | null = null;

	[ADD_ROUTE_KEY] = (route: RoutePoint, priority?: number) => {
		route.index = this._routeList.length;
		if(typeof priority === "number") {
			route.priority = priority;
		}
		Object.freeze(route);

		this._routeList.push(route);
		const {name} = route;
		if(this.added(name)) {
			this.credo.error("Duplicate route name {cyan %s}", name);
		} else {
			this._nameToRoute[name] = route;
		}
	};

	constructor(public credo: CredoJS) {

		const init = () => {
			this._init = true;

			Object.freeze(this);
			Object.freeze(this._routeList);
			Object.freeze(this._nameToRoute);
			Object.freeze(this._hostList);

			return this;
		};

		if(!credo.isApp()) {
			return init();
		}

		const conf = credo.config("routes");
		const {
			host = "*",
			routes = [],
			route404,
			sort = "native",
			middleware,
			... otherConf
		} = conf;

		this._hostList = createHostListRegExp(host);

		configRoute(routes, {... otherConf, middleware}, (route) => {
			this[ADD_ROUTE_KEY](route);
		});

		if(route404) {
			this._routeNotFound = new RouteEmptyPoint(configEmptyRoute(route404, otherConf));
		}

		credo.hooks.once("onBoot", () => {
			if(!this._sorted) {
				this.sort(sort);
			}
			init();
		});
	}

	isHost(ctx: Context): boolean {
		if(this._hostList.length === 0) {
			return true;
		}
		let host = String(ctx.hostname).trim().toLowerCase();
		if(!host.length) {
			return false;
		}
		if(!host.includes(":")) {
			host += `:${ctx.secure ? "443" : "80"}`;
		}
		return this._hostList.some(reg => reg.test(host));
	}

	isNotFoundRoute(): this is {routeNotFound: RouteEmptyPoint} {
		return this._routeNotFound != null;
	}

	get names() {
		return Object.keys(this._nameToRoute);
	}

	get length() {
		return this._routeList.length;
	}

	get routeList() {
		return this._routeList;
	}

	get routeNotFound() {
		return this._routeNotFound;
	}

	addRoute(route: RoutePoint | Route.Route, priority?: number) {
		if(this._init) {
			return this;
		}

		if(route instanceof RoutePoint) {
			this[ADD_ROUTE_KEY](route, priority);
			return this;
		}

		configRoute([route], {middleware: []}, (route) => {
			this[ADD_ROUTE_KEY](route, priority);
		});

		return this;
	}

	addNotFoundRoute(route: Route.EmptyRoute) {
		if(this._init) {
			return this;
		}
		this._routeNotFound = new RouteEmptyPoint(configEmptyRoute(route));
		return this;
	}

	remove(route: RoutePoint) {
		if(this._init) {
			return this;
		}

		const index = this._routeList.indexOf(route);
		if(index !== -1) {
			this._routeList.splice(index);
		}

		const key = Object.keys(this._nameToRoute).find(key => this._nameToRoute[key] === route);
		if(key) {
			delete this._nameToRoute[key];
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
		return this.added(name) && this._nameToRoute[name].pattern || null;
	}

	sort(type: "native" | "pattern" | ((a: RoutePoint, b: RoutePoint) => number)) {
		if(this._init) {
			return this;
		}
		this._sorted = true;
		if(typeof type === "function") {
			this._routeList.sort(type);
		} else if(type === "pattern") {
			this._routeList.sort(sortPattern);
		} else if(type === "native") {
			this._routeList.sort(sortNative);
		}
		return this;
	}
}