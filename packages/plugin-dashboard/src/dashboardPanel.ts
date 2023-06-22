import type { OnAppStateHook, OnResponseHook, PhragonJS } from "@phragon/server";
import { RoutePattern } from "@phragon/server";
import type { Context, Next } from "koa";
import type { Dashboard, DashboardPanel, DashboardStoreState } from "./types";
import type { OnJSONResponseErrorHook } from "@phragon/responder-json";
import { HttpJSON } from "@phragon/responder-json";
import { compilePath } from "@phragon/path-to-pattern";
import { apiGetState } from "./api";
import { homePageController } from "./web";
import createHttpError from "http-errors";
import { isPlainObject } from "@phragon-util/plain-object";
import { toAsync } from "@phragon-util/async";
import { HttpPage } from "@phragon/responder-page";
import { ctxGetError, ctxLoadLanguagePackage } from "./util";

type ApiModeType = "api" | "web" | "raw";

function createDashboardPath(path?: string) {
	let pref = String(typeof path === "string" ? path : "/dashboard").trim();
	if (pref.endsWith("/")) {
		pref = pref.replace(/\/+$/, "");
	}
	if (!pref.startsWith("/")) {
		pref = `/${pref}`;
	}
	return pref;
}

function ctxError500(ctx: Context) {
	if (ctx.status == 200 || !ctx.status) {
		ctx.status = 500;
	}
}

function createError(error: unknown) {
	if (error instanceof Error) {
		return error;
	}
	if (typeof error === "string") {
		return new Error(error);
	}
	if (error != null && typeof error === "object" && "message" in error) {
		return new Error(String(error.message));
	}
	return new Error("Unknown error");
}

export function createOnAppStateHook(phragon: PhragonJS) {
	const panel = phragon.dashboard;
	const { icon = "phragon", title = "PhragonJS" } = phragon.config("dashboard");

	return function onAppStateHook(event: OnAppStateHook<DashboardStoreState>) {
		const { state } = event;
		if (!state.dashboard) {
			state.dashboard = {
				icon,
				title,
				path: panel.path,
				patterns: { ...panel.patterns },
				menu: [],
				shortcutMenu: [],
				user: null,
			};
		} else {
			if (!state.dashboard.title) state.dashboard.title = title;
			if (!state.dashboard.path) state.dashboard.path = panel.path;
			if (!state.dashboard.patterns) state.dashboard.patterns = { ...panel.patterns };
			if (!state.dashboard.menu) state.dashboard.menu = [];
			if (!state.dashboard.shortcutMenu) state.dashboard.shortcutMenu = [];
			if (!state.dashboard.user) state.dashboard.user = null;
		}
	};
}

export function createOnResponseHook() {
	return async function onResponseHook(event: OnResponseHook) {
		await ctxLoadLanguagePackage(event.ctx, "dashboard");
	};
}

export function createOnLoadHook(phragon: PhragonJS) {
	return async function onLoadHook() {
		phragon.hooks.subscribe<OnJSONResponseErrorHook>("onJSONResponseError", async (event) => {
			if (event.overwritten) {
				return;
			}

			const { ctx, error } = event;
			const { message, codeName, code, payload } = await ctxGetError(ctx, error);
			const response = {
				ok: false,
				message,
			} as Dashboard.APIResponse;

			if (codeName != null) {
				response.codeName = codeName;
			}
			if (payload != null) {
				response.payload = payload;
			}

			event.json(response, code);
		});
	};
}

export function createDashboardPanel(phragon: PhragonJS) {
	const options = phragon.config("dashboard");
	const WebOriginPath = createDashboardPath(options.path);
	const WebPath = WebOriginPath === "/" ? WebOriginPath : `${WebOriginPath}/`;
	const ApiPath = `${WebPath}_api/`;
	const RawPath = `${WebPath}_raw/`;
	const ApiMethod = [
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
		"COPY",
		"HEAD",
		"LINK",
		"UNLINK",
		"PURGE",
		"LOCK",
		"UNLOCK",
		"PROPFIND",
		"VIEW",
	];

	// pattern

	const web = compilePath(`${WebPath}*`);
	const api = compilePath(`${ApiPath}*`);
	const raw = compilePath(`${RawPath}*`);
	const patterns: Record<string, string> = {
		"dashboard:web": `${WebPath}*`,
		"dashboard:api": `${ApiPath}*`,
		"dashboard:raw": `${RawPath}*`,
	};

	let homeController: Dashboard.PluginWebController | undefined = undefined;
	let errorPageController: Dashboard.PluginWebErrorController | undefined = undefined;

	const priority = { api: 2001, web: 1001, raw: 3000 };
	const details: Record<string, any> = {};
	const middlewareList: Dashboard.PluginMiddleware[] = [];
	const requestList: Record<string, Dashboard.PluginOnRequestCallback> = {};
	const plugins: string[] = [];
	const systemApi: Record<string, (ctx: Context) => Dashboard.APIResponse | Promise<Dashboard.APIResponse>> = {
		"GET:/_/state": apiGetState,
	};

	function has(name: string) {
		return plugins.includes(name);
	}

	async function _webFormat(ctx: Context, data: any = {}) {
		const event: { ctx: Context; data: any; page: string } = { ctx, data: {}, page: "dashboard" };

		if (HttpPage.isHttpPage(data)) {
			event.data = data.data;
			if (!data.page) {
				data.setPage("dashboard");
			} else {
				event.page = data.page;
			}
		} else if (isPlainObject(data)) {
			if (isPlainObject(data.response)) {
				event.data = data.response.data;
				if (!data.response.page) {
					data.response.page = "dashboard";
				} else {
					event.page = data.response.page;
				}
			} else if (isPlainObject(data.data)) {
				event.data = data.data;
				data = new HttpPage(data.data, data.code);
				data.page = "dashboard";
			} else {
				event.data = data;
				data = new HttpPage(data);
				data.page = "dashboard";
			}
		}

		await phragon.hooks.emit("onDashboardPage", event);

		return data;
	}

	async function _middleware(ctx: Context): Promise<{ ok: false; error: Error } | { ok: true; ended: boolean }> {
		let wait = true;
		const next = async (i: number) => {
			if (i < middlewareList.length) {
				const handler = middlewareList[i];
				await handler(ctx, async () => next(i + 1));
			} else {
				wait = false;
			}
		};

		try {
			await next(0);
		} catch (err) {
			ctxError500(ctx);
			return { ok: false, error: createError(err) };
		}

		if (wait) {
			ctxError500(ctx);
			return { ok: false, error: new Error("System error, some middleware was not completed") };
		}

		return { ok: true, ended: ctx.isBodyEnded };
	}

	function _tree(ctx: Context) {
		const { match } = ctx;
		if (!match || !match["*"] || !Array.isArray(match["*"])) {
			return ctx.throw("Invalid request", 400);
		}
		return match["*"].slice();
	}

	async function _ctx(
		ctx: Context,
		name: string,
		mode: ApiModeType
	): Promise<{ ok: true } | { ok: false; error: Error }> {
		Object.defineProperty(ctx, "dashboardPlugin", {
			value: Object.freeze(<Dashboard.PluginContext>{
				name,
				mode,
				details: { ...details[name] },
			}),
			writable: false,
		});
		// request
		if (requestList.hasOwnProperty(name)) {
			try {
				await toAsync(requestList[name](ctx));
			} catch (err) {
				ctxError500(ctx);
				return { ok: false, error: createError(err) };
			}
		}
		return { ok: true };
	}

	async function _web(ctx: Context) {
		const tree = _tree(ctx);

		// home page
		if (tree.length === 0) {
			const rq = await _ctx(ctx, "_:web", "web");
			if (!rq.ok) {
				return _pageError(ctx, rq.error);
			}
			const mw = await _middleware(ctx);
			if (!mw.ok) {
				return _pageError(ctx, mw.error);
			}
			if (mw.ended) {
				return;
			}
			return _tryCatch(ctx, "dashboard:web", "web", homeController || homePageController);
		}

		const rq = await _ctx(ctx, "_:error", "web");
		if (!rq.ok) {
			return _pageError(ctx, rq.error);
		}
		const mw = await _middleware(ctx);
		if (!mw.ok) {
			return _pageError(ctx, mw.error);
		}
		if (mw.ended) {
			return;
		}
		return _pageError(ctx, new createHttpError.NotFound());
	}

	async function _api(ctx: Context) {
		const tree = _tree(ctx);
		const pref = ctx.method + ":/" + tree.join("/");

		if (systemApi.hasOwnProperty(pref)) {
			const rq = await _ctx(ctx, "_:api", "api");
			if (!rq.ok) {
				throw rq.error;
			}
			const mw = await _middleware(ctx);
			if (!mw.ok) {
				throw mw.error;
			}
			if (mw.ended) {
				return;
			}
			return _tryCatch(ctx, "dashboard:api", "api", systemApi[pref]);
		}

		return new HttpJSON(
			{
				ok: false,
				message: "Invalid request",
			},
			500
		);
	}

	async function _pageError(ctx: Context, err: Error) {
		if (typeof errorPageController !== "function") {
			return err;
		}
		try {
			return await toAsync(errorPageController(ctx, err));
		} catch (err) {
			return createError(err);
		}
	}

	async function _tryCatch(
		ctx: Context,
		routeName: string,
		mode: ApiModeType,
		controller: (ctx: Context) => any | Promise<any>
	) {
		try {
			const data = await toAsync(controller(ctx));
			if (mode === "web") {
				return await _webFormat(ctx, data);
			} else if (mode === "raw" && data == null) {
				if (!ctx.isBodyEnded) {
					ctx.bodyEnd();
				}
				return void 0;
			}
			return data;
		} catch (err) {
			phragon.debug.error(`Dashboard plugin %s controller "%s" failure`, mode, routeName, err);
			if (mode === "web") {
				return _pageError(ctx, createError(err));
			}
			throw err;
		}
	}

	function _getPath(name: string, path?: string) {
		if (!path) {
			path = typeof path === "string" || name === "@" ? "" : name;
		} else {
			path = String(path).trim().replace(/^\/+/, "").replace(/\/+$/, "");
		}
		if (path.length) {
			path = `/${path}`;
		}
		return path;
	}

	function _route(
		mode: ApiModeType,
		pluginName: string,
		rule: Dashboard.PluginControllerRule<Dashboard.PluginController>
	) {
		let { name = "@", controller, path, method } = rule;
		path = _getPath(name, path);

		const isWeb = mode === "web";
		const isApi = mode === "api";

		if (isWeb) {
			method = ["GET"];
		} else if (!method) {
			method = isApi ? ApiMethod : ["GET"];
		} else if (typeof method === "string") {
			method = [method];
		}

		const routeName = `dashboard:${mode}.${pluginName}${name === "@" ? "" : `.${name}`}`;
		const routePath = (isWeb ? WebPath : isApi ? ApiPath : RawPath) + pluginName + path;
		const pattern = compilePath(routePath);
		patterns[routeName] = routePath;

		phragon.route.addRoute(
			new RoutePattern({
				pattern,
				methods: method.map((m) => String(m).toUpperCase().trim()),
				match(ctx) {
					return pattern.match(ctx.path);
				},
				context: {
					name: routeName,
					responder: { name: isWeb ? "page" : isApi ? "json" : "text" },
					controller: {
						name: Symbol(),
						handler: async (ctx: Context) => {
							const rq = await _ctx(ctx, pluginName, mode);
							if (!rq.ok) {
								if (isWeb) {
									return _pageError(ctx, rq.error);
								}
								throw rq.error;
							}
							const mw = await _middleware(ctx);
							if (!mw.ok) {
								if (isWeb) {
									return _pageError(ctx, mw.error);
								}
								throw mw.error;
							}
							if (mw.ended) {
								return;
							}
							return _tryCatch(ctx, routeName, mode, controller);
						},
					},
				},
			}),
			priority[mode]++
		);
	}

	function _isWeb(path: string) {
		if (path === WebPath) {
			return true;
		}
		for (const name of plugins) {
			const start = WebPath + name;
			if (start === path || path.startsWith(start + "/")) {
				return true;
			}
		}
		return false;
	}

	phragon.route
		.addRoute(
			new RoutePattern({
				pattern: api,
				methods: ApiMethod,
				match(ctx) {
					return api.match(ctx.path);
				},
				context: {
					name: "dashboard:api",
					responder: { name: "json" },
					controller: {
						name: Symbol(),
						handler: _api,
					},
				},
			}),
			2000
		)
		.addRoute(
			new RoutePattern({
				pattern: web,
				methods: ["GET"],
				match(ctx) {
					return "/" !== WebPath || _isWeb(ctx.path) ? web.match(ctx.path) : false;
				},
				context: {
					name: "dashboard:web",
					responder: { name: "page" },
					controller: {
						name: Symbol(),
						handler: _web,
					},
				},
			}),
			1000
		);

	function _loaded() {
		if (phragon.loaded) {
			throw new Error("Unable to define plugin after the system is already loaded");
		}
	}

	const panel: DashboardPanel = {
		get web() {
			return web;
		},
		get api() {
			return api;
		},
		get raw() {
			return raw;
		},
		get patterns() {
			return patterns;
		},
		get path() {
			return WebOriginPath;
		},
		definePlugin<Detail extends {} = any>(name: string, plugin: Dashboard.Plugin, options?: Detail) {
			_loaded();

			// duplicate name
			if (has(name)) {
				throw new Error(`The "${name}" plugin already defined`);
			}

			// validate name
			name = String(name || "").trim();
			if (name.length === 0 || /[^a-z\d\-]/.test(name)) {
				throw new Error(`The "${name}" invalid plugin name`);
			}

			plugins.push(name);
			details[name] = isPlainObject(options) ? options : {};

			const { api, web, raw, middleware, onRequest } = plugin;
			if (Array.isArray(api)) {
				api.forEach((rule) => {
					const { controller, ...rest } = rule;
					_route("api", name, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof api === "function") {
				_route("api", name, {
					name: "home",
					path: "/*",
					controller: (ctx: Context) => api.call(plugin, ctx),
				});
			}

			if (Array.isArray(web)) {
				web.forEach((rule) => {
					const { controller, ...rest } = rule;
					_route("web", name, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof web === "function") {
				_route("web", name, {
					name: "home",
					path: "/*",
					controller: (ctx: Context) => web.call(plugin, ctx),
				});
			}

			if (Array.isArray(raw)) {
				raw.forEach((rule) => {
					const { controller, ...rest } = rule;
					_route("raw", name, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof raw === "function") {
				_route("raw", name, { name: "home", path: "/*", controller: (ctx: Context) => raw.call(plugin, ctx) });
			}

			if (Array.isArray(middleware)) {
				middleware.forEach((callback) => {
					middlewareList.push((ctx: Context, next: Next) => callback.call(plugin, ctx, next));
				});
			} else if (typeof middleware === "function") {
				middlewareList.push((ctx: Context, next: Next) => middleware.call(plugin, ctx, next));
			}

			if (typeof onRequest === "function") {
				requestList[name] = (ctx: Context) => onRequest.call(plugin, ctx);
			}
		},
		defineHomePageController(controller: Dashboard.PluginWebController) {
			_loaded();
			if (typeof controller === "function") {
				if (homeController) {
					phragon.debug.error("Dashboard homepage controller has been overridden");
				}
				homeController = controller;
			}
		},
		defineErrorPageController(controller: Dashboard.PluginWebErrorController) {
			_loaded();
			if (typeof controller === "function") {
				if (errorPageController) {
					phragon.debug.error("Dashboard error controller has been overridden");
				}
				errorPageController = controller;
			}
		},
		pluginDefined(name: string): boolean {
			return has(name);
		},
		pluginDetail<T extends {} = {}>(name: string): T {
			return (has(name) ? details[name] : {}) as T;
		},
	};

	Object.freeze(panel);
	return panel;
}
