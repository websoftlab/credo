import type {
	OnPageHTMLBeforeRenderHook,
	OnPageJSONBeforeRenderHook,
	ResponderPageHandlerProps,
	ResponderPageOptions,
	ResponderPageResult,
	ResponderPageResultFound,
	LoadManifestOptions,
} from "./types";
import type { PhragonJS, Ctor, Route } from "@phragon/server";
import type { Context } from "koa";
import { isHttpStatus, isRedirectCode } from "./utils/status";
import { htmlEscape } from "@phragon/utils";
import HtmlDocument from "./HtmlDocument";
import { loadManifest } from "./utils/manifest";
import HttpRedirect from "./HttpRedirect";
import HttpPage from "./HttpPage";
import createHttpError from "http-errors";
import { buildQuery } from "@phragon/make-url";
import getRenderDriver from "./getRenderDriver";

function createRoute(result: any, name: string): Route.Context {
	return {
		name,
		controller: {
			name: Symbol(),
			handler: () => result,
		},
		responder: {
			name: "page",
		},
	};
}

export default (function responder(phragon: PhragonJS, name: string) {
	if (!phragon.isApp()) {
		throw new Error("PhragonJS not starting in application mode");
	}

	if (!phragon.renderHTMLDriver) {
		throw new Error("PhragonJS.renderHTMLDriver is not defined");
	}

	const renderHTMLDriver = phragon.renderHTMLDriver;
	const options = phragon.config<ResponderPageOptions>(`responder/${name}`);

	const manifestOptions: LoadManifestOptions = {
		envMode: phragon.envMode,
		devServerHost: phragon.env.get("devServerHost").value,
		devServerPort: phragon.env.get("devServerPort").value,
	};

	if (phragon.process) {
		manifestOptions.mid = phragon.process.mid;
	}

	const PAGE_KEY = Symbol("page-key");
	const IS_PAGE_KEY = Symbol("is-page-key");
	const { ssr = true, getQueryId = "query", baseUrl = "/" } = options;

	phragon.hooks.subscribe("onResponse", (evn) => {
		const { ctx } = evn;
		const redirectNative = ctx.redirect;
		ctx.redirect = (url: string, alt?: string) => {
			if (isPageJSON(ctx)) {
				ctx.bodyEnd({
					redirect: {
						location: url,
					},
				});
			} else {
				redirectNative.call(ctx, url, alt);
				ctx.bodyEnd();
			}
		};
	});

	phragon.hooks.subscribe("onResponseRoute", (evn) => {
		const { ctx, notFound } = evn;
		const { route } = ctx;

		if (!isPageJSON(ctx) || (route && route.responder.name === "page")) {
			return;
		}

		if (!route || notFound) {
			ctx.route = createRoute(
				createHttpError(404, ctx.store.translate("system.page.notFound", "Page not found")),
				"404"
			);
		} else {
			// redirect
			let location = ctx.path;
			let query = Object.assign({}, ctx.query);
			Reflect.deleteProperty(query, ctx[PAGE_KEY as never]);

			if (Object.keys(query).length > 0) {
				const search = buildQuery(query);
				if (search) {
					location += `?${search}`;
				}
			}

			ctx.route = createRoute(new HttpRedirect(location, true), `redirect:${location}`);
		}
	});

	function isFound(data: any): data is ResponderPageResultFound {
		return [200, 201, 202, 203, 205, 206, 207, 208, 226].includes(data.code);
	}

	function isPageQueryId(query: any = {}): null | string {
		for (const key of Object.keys(query)) {
			if (!query[key] && key.startsWith(getQueryId) && /^-\d+$/.test(key.substring(getQueryId.length))) {
				return key;
			}
		}
		return null;
	}

	function isPageJSON(ctx: Context): boolean {
		let test: boolean | undefined = ctx[IS_PAGE_KEY as never];
		if (typeof test === "boolean") {
			return test;
		}
		let found: null | string = null;
		if (ctx.accepts("html", "json") === "json") {
			if (ctx.method === "GET") {
				found = isPageQueryId(ctx.query);
			} else if (ctx.method === "POST") {
				found = isPageQueryId(ctx.request.body);
			}
		}
		test = found !== null;
		Object.defineProperty(ctx, IS_PAGE_KEY, { value: test });
		if (test) {
			Object.defineProperty(ctx, PAGE_KEY, { value: found });
		}
		return test;
	}

	function sendRedirect(ctx: Context, location: string, code?: number, back: boolean = false) {
		location = String(location).trim();
		if (!location) {
			location = "/";
		}
		if (isPageJSON(ctx)) {
			ctx.bodyEnd({
				redirect: {
					location,
					back,
				},
			});
		} else {
			ctx.redirect(location);
			ctx.bodyEnd(
				`<html lang="${htmlEscape(
					ctx.language
				)}"><head><title>Redirect...</title><meta http-equiv="refresh" content="0; url=${htmlEscape(
					location
				)}" /></head></html>`,
				code && isRedirectCode(code) ? code : undefined,
				"text/html; charset=utf-8"
			);
		}
	}

	async function sendHtml(ctx: Context, data: any, ssrProp?: boolean) {
		const code = data.code;
		const document = new HtmlDocument(await getRenderDriver(renderHTMLDriver, data));
		const manifest = await loadManifest(manifestOptions);

		document.language = ctx.language;
		document.getQueryId = getQueryId;
		document.ssr = phragon.ssr ? (typeof ssrProp === "boolean" ? ssrProp : ssr) : false;
		document.baseUrl = baseUrl;
		document.styles = manifest.styles.slice();
		document.scripts = manifest.scripts.slice();

		// fire hook
		await phragon.hooks.emit<OnPageHTMLBeforeRenderHook>("onPageHTMLBeforeRender", { ctx, document });
		if (ctx.isBodyEnded) {
			return;
		}

		let type = "text/html";
		if (document.charset) {
			type += `; ${document.charset}`;
		}

		ctx.bodyEnd(await document.toHTML(ctx), code, type);
	}

	async function sendJSON(ctx: Context, code: number, body: any) {
		body = {
			code,
			...body,
		};

		// fire hook
		await phragon.hooks.emit<OnPageJSONBeforeRenderHook>("onPageJSONBeforeRender", {
			ctx,
			body,
			isError: !body.ok,
		});

		ctx.bodyEnd(body, body.code);
	}

	function sendError(ctx: Context, message: string, code: number, ssr?: boolean) {
		if (!message) {
			message = ctx.store.translate("system.page.unknownServerError", "Unknown server error");
		}
		if (isPageJSON(ctx)) {
			return sendJSON(ctx, code, { ok: false, message });
		} else {
			return sendHtml(
				ctx,
				{
					found: false,
					code,
					message,
				},
				ssr
			);
		}
	}

	function sendPage(ctx: Context, response: { page: string; data: any; props: any }, code: number, ssr?: boolean) {
		if (isPageJSON(ctx)) {
			return sendJSON(ctx, code, { ok: true, response });
		} else {
			return sendHtml(
				ctx,
				{
					found: true,
					code,
					response,
				},
				ssr
			);
		}
	}

	function parseError(ctx: Context, error: Error) {
		let code = 500;
		let message = "";
		if (createHttpError.isHttpError(error)) {
			code = error.status;
			if (error.expose) {
				message = error.message;
			}
		} else {
			message = ctx.store.translate("system.page.invalidError", "Invalid error");
		}
		return { code, message };
	}

	async function responder(ctx: Context, result: ResponderPageResult | Error, props: ResponderPageHandlerProps = {}) {
		if (renderHTMLDriver == null) {
			throw new Error("renderHTMLDriver is not defined");
		}

		const { page: pagePage = "Index", props: pageProps = {}, ssr } = props;

		if (result == null) {
			throw new Error("Responder result is empty");
		}

		if (typeof result !== "object") {
			throw new Error("Invalid page responder type, object expected");
		}

		if (HttpRedirect.isHttpRedirect(result)) {
			return sendRedirect(ctx, result.location, undefined, result.back);
		}

		if (HttpPage.isHttpPage(result)) {
			return sendPage(
				ctx,
				{
					data: result.data,
					page: result.page || pagePage,
					props: {
						...result.props,
						...props,
					},
				},
				result.status,
				typeof result.ssr === "boolean" ? result.ssr : ssr
			);
		}

		if (result instanceof Error) {
			const { code, message } = parseError(ctx, result);
			return sendError(ctx, message, code, ssr);
		}

		// redirect page
		if ("redirect" in result) {
			const { code, redirect } = result;
			return sendRedirect(ctx, typeof redirect === "string" ? redirect : redirect.location || "/", code);
		}

		let { code } = result;
		if (isRedirectCode(code)) {
			if ("location" in result) {
				return sendRedirect(ctx, (result as any).location || "/", code);
			} else {
				throw new Error('For redirect use object {"redirect": {"location": string}}');
			}
		}

		if (code === 204) {
			throw new Error("Empty 204 code is not allowed");
		}

		// page found
		if (isFound(result)) {
			if ("data" in result) {
				return sendPage(ctx, { data: result.data, page: pagePage, props: pageProps }, code);
			}
			if ("response" in result && typeof result.response === "object") {
				const {
					response: { data, page, props },
				} = result;
				return sendPage(
					ctx,
					{
						data,
						page: page || pagePage,
						props: {
							...pageProps,
							...props,
						},
					},
					code,
					ssr
				);
			}
			throw new Error("Invalid request (data or response not found)");

			// page not found
		} else {
			return sendError(ctx, result.message, isHttpStatus(code) ? code : 500, ssr);
		}
	}

	return {
		name,
		responder,
		error(ctx: Context, error: Error) {
			const { code, message } = parseError(ctx, error);
			return sendError(ctx, message || ctx.store.translate("system.page.queryError", "Query error"), code, ssr);
		},
	};
} as Ctor.Responder);
