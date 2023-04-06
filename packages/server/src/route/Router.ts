import type { RouteConfig, Config } from "../types";
import { getNRCP } from "./RouteManager";

function getRouteObject<T extends RouteConfig.Route | RouteConfig.EmptyRoute>(
	options: T
): T extends RouteConfig.Route ? RouteConfig.RouteObject : RouteConfig.EmptyRouteObject {
	if (typeof options === "string" || Array.isArray(options)) {
		return getNRCP(options);
	}
	if (typeof options !== "object") {
		return {};
	}
	if (typeof options === "object" && "nrpc" in options && typeof options.nrpc === "string") {
		const { nrpc, ...rest } = options;
		return {
			...rest,
			...getNRCP(nrpc),
		};
	}
	return options;
}

function fillRouter<T extends Router | EmptyRouter | RootRouter>(router: T, options: RouteConfig.EmptyRouteObject) {
	if (options.name) router.name = options.name;
	if (options.method) router.method = options.method;
	if (options.middleware) router.middleware = options.middleware;
	if (options.controller) router.controller = options.controller;
	if (options.responder) router.responder = options.responder;
	if (options.cache) router.cache = options.cache;
	if (options.details) router.details = options.details;
	return router;
}

function newRouter(options: RouteConfig.Route, top?: { method?: RouteConfig.Method }) {
	options = getRouteObject(options);
	if (top) {
		options = { ...options, ...top };
	}

	const router = fillRouter(new Router(), options);

	if (options.path) router.path = options.path;
	if (options.group) router.group = true;
	if (Array.isArray(options.routes) && options.routes.length) {
		for (const rt of options.routes) {
			router.routes.push(newRouter(rt));
		}
	}

	return router;
}

function add(
	router: Router | RouterList,
	options: RouteConfig.Route,
	child?: RouterChildCallback,
	top?: { group?: boolean; method?: RouteConfig.Method }
) {
	const nr = newRouter(options, top);
	router.routes.push(nr);
	if (typeof child === "function") {
		child(nr);
	}
	return router;
}

type RouterChildCallback = (router: Router) => void;

export class EmptyRouter {
	public cache: RouteConfig.Cache = false;
	public method: RouteConfig.Method | null = null;
	public name: string | null = null;
	public controller: RouteConfig.Controller | null = null;
	public responder: string | [string, any] | null = null;
	public details: any = null;
	public middleware: RouteConfig.ExtraMiddlewareType[] = [];

	toConfigObject() {
		const config: RouteConfig.EmptyRouteObject = {};
		if (this.cache) config.cache = this.cache;
		if (this.method && (typeof this.method === "string" || this.method.length > 0)) config.method = this.method;
		if (this.name) config.name = this.name;
		if (this.controller) config.controller = this.controller;
		if (this.responder) config.responder = this.responder;
		if (this.details) config.details = this.details;
		if (this.middleware.length > 0) config.middleware = this.middleware;
		return config;
	}
}

abstract class RouterList extends EmptyRouter {
	public routes: Router[] = [];

	get(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "get" });
	}

	post(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "post" });
	}

	getPost(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: ["get", "post"] });
	}

	put(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "put" });
	}

	delete(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "delete" });
	}

	push(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "push" });
	}

	head(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child, { method: "head" });
	}

	route(options: RouteConfig.Route, child?: RouterChildCallback) {
		return add(this, options, child);
	}

	groupIn(options: RouteConfig.Route, child: RouterChildCallback) {
		return add(this, options, child, { group: true });
	}

	methodIn(...method: string[]) {
		return (options: RouteConfig.Route, child?: RouterChildCallback) => {
			return add(this, options, child, { method });
		};
	}

	toConfigObject() {
		const config: RouteConfig.EmptyRouteObject & { routes?: RouteConfig.Route[] } = super.toConfigObject();
		if (this.routes.length > 0) {
			config.routes = this.routes.map((item) => item.toConfigObject());
		}
		return config;
	}
}

export class RootRouter extends RouterList {
	public host?: string | string[] | null = null;
	public path?: string | null = null;
	public notFoundRouter: EmptyRouter | null = null;
	public sort?: "native" | "pattern";
	toConfigObject() {
		const { controller, responder, ...rest } = super.toConfigObject();
		const config: Config.Route = rest;
		if (typeof controller === "string") config.controller = controller;
		if (typeof responder === "string") config.responder = responder;
		if (this.host) config.host = this.host;
		if (this.path) config.path = this.path;
		if (this.sort) config.sort = this.sort;
		if (this.notFoundRouter) config.route404 = this.notFoundRouter.toConfigObject();
		return config;
	}

	route404(options: EmptyRouter | RouteConfig.EmptyRoute | null) {
		if (options == null) {
			this.notFoundRouter = null;
		} else if (options instanceof EmptyRouter) {
			this.notFoundRouter = options;
		} else {
			this.notFoundRouter = create404Router(options);
		}
		return this;
	}
}

export class Router extends RouterList {
	public group: boolean = false;
	public path: RouteConfig.Path | null = null;
	toConfigObject() {
		const config: RouteConfig.RouteObject = super.toConfigObject();
		if (this.group) config.group = true;
		if (this.path) config.path = this.path;
		return config;
	}
}

export function createRouter(options: RouteConfig.Route) {
	return newRouter(options);
}

export function create404Router(options: RouteConfig.EmptyRoute) {
	return fillRouter(new EmptyRouter(), getRouteObject(options));
}

export function createRootRouter(config: Config.Route = {}) {
	const { route404, host, sort, ...rest } = config;
	const router = fillRouter(new RootRouter(), getRouteObject(rest));
	if (route404) router.route404(route404);
	if (host && (typeof host === "string" || host.length > 0)) router.host = host;
	if (sort) router.sort = sort;
	return router;
}
