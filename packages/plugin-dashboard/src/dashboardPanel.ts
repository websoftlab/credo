import type { OnAppStateHook, OnResponseHook, PhragonJS } from "@phragon/server";
import { RoutePattern } from "@phragon/server";
import type { Context, Next } from "koa";
import type { Dashboard, DashboardPanel, DashboardStoreState } from "./types";
import type { OnJSONResponseErrorHook } from "@phragon/responder-json";
import { HttpJSON } from "@phragon/responder-json";
import type { ValidateService } from "@phragon/plugin-validator";
import { compilePath } from "@phragon/path-to-pattern";
import { apiGetState } from "./api";
import { homePageController } from "./web";
import createHttpError from "http-errors";
import { __isDev__ } from "@phragon-util/global-var";
import { isPlainObject } from "@phragon-util/plain-object";
import { toAsync } from "@phragon-util/async";
import { HttpPage } from "@phragon/responder-page";
import { DisplayError, ConfirmationError } from "./error";

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
		const { ctx } = event;
		if (!ctx.store.packages.includes("dashboard")) {
			await ctx.store.loadLanguage(ctx.store.language, "dashboard");
		}
	};
}

export function createOnLoadHook(phragon: PhragonJS) {
	return async function onLoadHook() {
		const validator: ValidateService | undefined = phragon.services.validator;
		phragon.hooks.subscribe<OnJSONResponseErrorHook>("onJSONResponseError", (event) => {
			if (event.overwritten) {
				return;
			}

			const { ctx, error } = event;
			const prefix = ctx.dashboardPlugin ? "dashboard:" : "validate:";

			function codeNameMessage(message: string, codeName: string | null, slug: string) {
				if (codeName == null) {
					codeName = `${prefix}message.${message}`;
				} else if (!codeName.includes(":")) {
					codeName = `${prefix}${slug}.${codeName}`;
				}
				return ctx.store.translate(codeName, message);
			}

			if (DisplayError.isError(error)) {
				const { message, codeName } = error;
				return event.json(
					{
						ok: false,
						codeName: "displayError",
						message: codeNameMessage(message, codeName, "display"),
					} as Dashboard.APIResponse,
					500
				);
			}

			if (ConfirmationError.isError(error)) {
				const { message, codeName, data } = error;
				return event.json(
					{
						ok: false,
						codeName: "confirmationError",
						message:
							error.message ||
							ctx.store.translate(`${prefix}confirmationRequired`, "Confirmation required"),
						payload: {
							message: codeNameMessage(message, codeName, "confirmation"),
							data,
						},
					} as Dashboard.APIResponse,
					400
				);
			}

			if (validator) {
				if (validator.isValidateDataError(error)) {
					return event.json(
						{
							ok: false,
							codeName: "validateError",
							message: error.message || ctx.store.translate(`${prefix}dataError`, "Data error"),
							payload: {
								errors: error.errors,
							},
						} as Dashboard.APIResponse,
						400
					);
				}
				if (validator.isValidateError(error)) {
					return event.json(
						{
							ok: false,
							codeName: "validateError",
							message: ctx.store.translate(`${prefix}dataError`, "Data error"),
							payload: {
								errors: {
									[error.field]: error.message,
								},
							},
						} as Dashboard.APIResponse,
						400
					);
				}
			}

			const code = createHttpError.isHttpError(error) ? error.statusCode : 500;
			let message = "Query error";
			if (__isDev__() || createHttpError.isHttpError(error)) {
				const text = (error as Error).message;
				if (text) {
					message = text;
				}
			}

			event.json(
				{
					ok: false,
					message: ctx.store.translate(`${prefix}message.${message}`, message),
				} as Dashboard.APIResponse,
				code
			);
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

	const priority = [2001, 1001, 3000];
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

		// resort menu
		if (data.page === "dashboard" && Array.isArray(event.data.menu)) {
			event.data.menu = event.data.menu.sort((l: { depth?: number }, r: { depth?: number }) => {
				return (l.depth || 0) - (r.depth || 0);
			});
		}

		return data;
	}

	async function _middleware(ctx: Context) {
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
			if (ctx.dashboardPlugin?.mode === "api") {
				ctx.bodyEnd({
					ok: false,
					message: createHttpError.isHttpError(err) ? err.message : "Query error",
				});
			} else if (typeof errorPageController === "function") {
				ctx.bodyEnd(errorPageController(ctx, err as Error), 500);
			} else {
				throw err;
			}
		}

		return !(wait || ctx.isBodyEnded);
	}

	function _tree(ctx: Context) {
		const { match } = ctx;
		if (!match || !match["*"] || !Array.isArray(match["*"])) {
			return ctx.throw("Invalid request", 400);
		}
		return match["*"].slice();
	}

	async function _ctx(ctx: Context, name: string, mode: "api" | "web" | "raw") {
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
			await toAsync(requestList[name](ctx));
		}
	}

	async function _web(ctx: Context) {
		const tree = _tree(ctx);

		// home page
		if (tree.length === 0) {
			await _ctx(ctx, "_:web", "web");
			if (!(await _middleware(ctx))) {
				return;
			}
			return _tryCatch(ctx, "dashboard:web", false, homeController || homePageController);
		}

		await _ctx(ctx, "_:error", "web");
		if (!(await _middleware(ctx))) {
			return;
		}

		const error = new createHttpError.NotFound();
		if (typeof errorPageController === "function") {
			return errorPageController(ctx, error);
		} else {
			throw error;
		}
	}

	async function _api(ctx: Context) {
		const tree = _tree(ctx);
		const pref = ctx.method + ":/" + tree.join("/");

		if (systemApi.hasOwnProperty(pref)) {
			await _ctx(ctx, "_:api", "api");
			if (!(await _middleware(ctx))) {
				return;
			}
			return _tryCatch(ctx, "dashboard:api", true, systemApi[pref]);
		}

		return new HttpJSON(
			{
				ok: false,
				message: "Invalid request",
			},
			500
		);
	}

	async function _tryCatch(
		ctx: Context,
		routeName: string,
		isApi: boolean,
		controller: (ctx: Context) => any | Promise<any>
	) {
		try {
			const data = await toAsync(controller(ctx));
			if (!isApi) {
				return await _webFormat(ctx, data);
			}
			return data;
		} catch (err) {
			phragon.debug.error(`Dashboard plugin controller "%s" failure`, routeName, err);
			if (!isApi && typeof errorPageController === "function") {
				return errorPageController(ctx, err as Error);
			} else {
				throw err;
			}
		}
	}

	function _getPath(name: string, path?: string) {
		if (!path) {
			path = typeof path === "string" ? "" : name;
		} else {
			path = String(path).trim().replace(/^\/+/, "").replace(/\/+$/, "");
		}
		if (path.length) {
			path = `/${path}`;
		}
		return path;
	}

	function _routeRaw(pluginName: string, rule: Dashboard.PluginControllerRule<Dashboard.PluginController<void>>) {
		let { name = pluginName, controller, path, method } = rule;
		path = _getPath(name, path);

		if (!method) {
			method = ["GET"];
		} else if (typeof method === "string") {
			method = [method];
		}

		const routeName = `dashboard:raw.${pluginName}${name === "@" ? "" : `.${name}`}`;
		const routePath = RawPath + pluginName + path;
		const pattern = compilePath(routePath);
		patterns[routeName] = routePath;

		phragon.route.addRoute(
			new RoutePattern({
				pattern,
				methods: method,
				match(ctx) {
					return pattern.match(ctx.path);
				},
				context: {
					name: routeName,
					responder: { name: "text" },
					controller: {
						name: Symbol(),
						handler: async (ctx: Context) => {
							await _ctx(ctx, pluginName, "raw");
							if (!(await _middleware(ctx))) {
								return;
							}
							try {
								await toAsync(controller(ctx));
							} catch (err) {
								phragon.debug.error(`Dashboard plugin controller "%s" failure`, routeName, err);
								return err;
							}
							if (!ctx.isBodyEnded) {
								ctx.bodyEnd();
							}
						},
					},
				},
			}),
			priority[2]++
		);
	}

	function _route(
		pluginName: string,
		isApi: boolean,
		rule: Dashboard.PluginControllerRule<Dashboard.PluginController>
	) {
		let { name = pluginName, controller, path, method } = rule;
		path = _getPath(name, path);

		if (!isApi) {
			method = ["GET"];
		} else if (!method) {
			method = ApiMethod;
		} else if (typeof method === "string") {
			method = [method];
		}

		const routeName = `dashboard:${isApi ? "api." : "web."}${pluginName}${name === "@" ? "" : `.${name}`}`;
		const routePath = (isApi ? ApiPath : WebPath) + pluginName + path;
		const pattern = compilePath(routePath);
		patterns[routeName] = routePath;

		phragon.route.addRoute(
			new RoutePattern({
				pattern,
				methods: method,
				match(ctx) {
					return pattern.match(ctx.path);
				},
				context: {
					name: routeName,
					responder: { name: isApi ? "json" : "page" },
					controller: {
						name: Symbol(),
						handler: async (ctx: Context) => {
							await _ctx(ctx, pluginName, isApi ? "api" : "web");
							if (!(await _middleware(ctx))) {
								return;
							}
							return _tryCatch(ctx, routeName, isApi, controller);
						},
					},
				},
			}),
			priority[isApi ? 0 : 1]++
		);
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
					return web.match(ctx.path);
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
					_route(name, true, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof api === "function") {
				_route(name, true, { name: "home", path: "/*", controller: (ctx: Context) => api.call(plugin, ctx) });
			}

			if (Array.isArray(web)) {
				web.forEach((rule) => {
					const { controller, ...rest } = rule;
					_route(name, false, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof web === "function") {
				_route(name, false, { name: "home", path: "/*", controller: (ctx: Context) => web.call(plugin, ctx) });
			}

			if (Array.isArray(raw)) {
				raw.forEach((rule) => {
					const { controller, ...rest } = rule;
					_routeRaw(name, { ...rest, controller: (ctx: Context) => controller.call(plugin, ctx) });
				});
			} else if (typeof raw === "function") {
				_routeRaw(name, { name: "home", path: "/*", controller: (ctx: Context) => raw.call(plugin, ctx) });
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
		defineErrorController(controller: Dashboard.PluginWebErrorController) {
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
