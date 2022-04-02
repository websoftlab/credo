import type {
	OnPageHTMLBeforeRenderHook,
	OnPageJSONBeforeRenderHook, ResponderPageHandlerProps,
	ResponderPageOptions, ResponderPageResult, ResponderPageResultFound,
	LoadManifestOptions
} from "./types";
import type {CredoJS, Route} from "@credo-js/server";
import type {Context} from "koa";
import {isHttpStatus, isRedirectCode} from "./utils/status";
import {htmlEscape} from "@credo-js/utils";
import HtmlDocument from "./HtmlDocument";
import {loadManifest} from "./utils/manifest";
import HttpRedirect from "./HttpRedirect";
import HttpPage from "./HttpPage";
import createHttpError from "http-errors";
import {buildQuery} from "@credo-js/make-url";
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

export default (function responder(credo: CredoJS, name: string) {

	if(!credo.isApp()) {
		throw new Error("CredoJS not starting in application mode");
	}

	if(!credo.renderHTMLDriver) {
		throw new Error("CredoJS.renderHTMLDriver is not defined");
	}

	const renderHTMLDriver = credo.renderHTMLDriver;
	const options = credo.config<ResponderPageOptions>(`responder/${name}`);

	const manifestOptions: LoadManifestOptions = {
		envMode: credo.envMode,
		devServerHost: credo.env.get("devServerHost").value,
		devServerPort: credo.env.get("devServerPort").value,
	};

	if(credo.process) {
		manifestOptions.mid = credo.process.mid;
	}

	const {
		ssr = true,
		getQueryId = "query",
		baseUrl = "/",
	} = options;

	credo.hooks.subscribe("onResponse", (evn) => {
		const {ctx} = evn;
		const redirectNative = ctx.redirect;
		ctx.redirect = (url: string, alt?: string) => {
			if(isPageJSON(ctx)) {
				ctx.body = {
					redirect: {
						location: url,
					},
				};
			} else {
				return redirectNative(url, alt);
			}
		};
	});

	credo.hooks.subscribe("onResponseRoute", (evn) => {
		const {ctx, notFound} = evn;
		const {route} = ctx;

		if(!isPageJSON(ctx) || route && route.responder.name === "page") {
			return;
		}

		if(!route || notFound) {
			ctx.route = createRoute(createHttpError(ctx.store.translate("system.page.notFound", "Page not found"), 404), "404");
		} else {
			// redirect
			let location = ctx.path;
			let {t, ... query} = ctx.query;
			if(query) {
				const search = buildQuery(query);
				if(search) {
					location += `?${search}`;
				}
			}
			ctx.route = createRoute(new HttpRedirect(location), `redirect:${location}`);
		}
	});

	function isFound(data: any): data is ResponderPageResultFound {
		return [200, 201, 202, 203, 205, 206, 207, 208, 226].includes(data.code);
	}

	function isPageJSON(ctx: Context) {
		if(ctx.method === "GET" && ctx.accepts('html', 'json') === "json" && typeof ctx.query.t === "string") {
			const [qid] = ctx.query.t.split("-", 2);
			return qid === getQueryId;
		}
		return false;
	}

	function sendRedirect(ctx: Context, location: string, code?: number) {
		location = String(location).trim();
		if (!location) {
			location = "/";
		}
		if (isPageJSON(ctx)) {
			ctx.body = {
				redirect: {
					location,
				},
			};
		} else {
			ctx.redirect(location);
			if (code && isRedirectCode(code)) {
				ctx.status = code;
			}
			ctx.type = "text/html; charset=utf-8";
			ctx.body = `<html lang="${htmlEscape(ctx.language)}"><head><title>Redirect...</title><meta http-equiv="refresh" content="0; url=${htmlEscape(location)}" /></head></html>`;
		}
	}

	async function sendHtml(ctx: Context, data: any, ssrProp?: boolean) {
		const code = data.code;
		const document = new HtmlDocument(await getRenderDriver(renderHTMLDriver, data));
		const manifest = await loadManifest(manifestOptions);

		document.language = ctx.language;
		document.getQueryId = getQueryId;
		document.ssr = credo.ssr ? (typeof ssrProp === "boolean" ? ssrProp : ssr) : false;
		document.baseUrl = baseUrl;
		document.styles = manifest.styles.slice();
		document.scripts = manifest.scripts.slice();

		// fire hook
		await credo.hooks.emit<OnPageHTMLBeforeRenderHook>("onPageHTMLBeforeRender", {ctx, document});
		if (ctx.res.writableEnded) {
			return;
		}

		let type = "text/html";
		if (document.charset) {
			type += `; ${document.charset}`;
		}

		ctx.status = code;
		ctx.type = type;
		ctx.body = await document.toHTML(ctx);
	}

	async function sendJSON(ctx: Context, code: number, body: any) {
		body = {
			code,
			...body
		};

		// fire hook
		await credo.hooks.emit<OnPageJSONBeforeRenderHook>("onPageJSONBeforeRender", {
			ctx,
			body,
			isError: "message" in body
		});
		if (ctx.res.writableEnded) {
			return;
		}

		ctx.status = body.code;
		ctx.body = body;
	}

	function sendError(ctx: Context, message: string, code: number, ssr?: boolean) {
		if (!message) {
			message = ctx.store.translate("system.page.unknownServerError", "Unknown server error");
		}
		if (isPageJSON(ctx)) {
			return sendJSON(ctx, code, {message});
		} else {
			return sendHtml(ctx, {
				found: false,
				code,
				message,
			}, ssr);
		}
	}

	function sendPage(ctx: Context, response: { page: string, data: any, props: any }, code: number, ssr?: boolean) {
		if (isPageJSON(ctx)) {
			return sendJSON(ctx, code, {response});
		} else {
			return sendHtml(ctx, {
				found: true,
				code,
				response,
			}, ssr);
		}
	}

	async function responder(ctx: Context, result: ResponderPageResult, props: ResponderPageHandlerProps = {}) {

		if (renderHTMLDriver == null) {
			throw new Error("renderHTMLDriver is not defined");
		}

		const {page: pagePage = "Index", props: pageProps = {}, ssr} = props;

		if (HttpRedirect.isHttpRedirect(result)) {
			return sendRedirect(ctx, result.location);
		}

		if (HttpPage.isHttpPage(result)) {
			return sendPage(ctx, {
				data: result.data,
				page: result.page || pagePage,
				props: {
					...result.props,
					...props,
				}
			}, result.status, typeof result.ssr === "boolean" ? result.ssr : ssr);
		}

		if (createHttpError.isHttpError(result)) {
			return sendError(ctx, result.message, result.status, ssr);
		}

		// redirect page
		if ("redirect" in result) {
			const {code, redirect} = result;
			return sendRedirect(ctx, typeof redirect === "string" ? redirect : (redirect.location || "/"), code);
		}

		let {code} = result;
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
				return sendPage(ctx, {data: result.data, page: pagePage, props: pageProps}, code);
			}
			if ("response" in result && typeof result.response === "object") {
				const {
					response: {
						data,
						page,
						props,
					}
				} = result;
				return sendPage(ctx, {
					data,
					page: page || pagePage,
					props: {
						...pageProps,
						...props,
					}
				}, code, ssr);
			}
			throw new Error("Invalid request (data or response not found)")

			// page not found
		} else {
			return sendError(ctx, result.message, isHttpStatus(code) ? code : 500, ssr);
		}
	}

	return {
		name,
		responder,
		error(ctx: Context, error: Error) {
			if (isPageJSON(ctx)) {
				let code = 500;
				let message = "";
				if (createHttpError.isHttpError(error)) {
					code = error.status;
					if (error.expose) {
						message = error.message;
					}
				}
				ctx.status = code < 600 ? code : 500;
				ctx.body = {
					code,
					message: message || ctx.store.translate("system.page.queryError", "Query error"),
				};
			} else {
				throw error;
			}
		}
	}
}) as Route.ResponderCtor;