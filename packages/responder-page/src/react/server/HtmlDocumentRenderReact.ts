import type {ReactElement, ElementType} from "react";
import type {Context} from "koa";
import type {AxiosInstance} from "axios";
import type {HeadTag} from "@credo-js/html-head";
import type {API, Page, Render} from "../../types";
import {createElement} from "react";
import HtmlNode from "../../HtmlNode";
import ReactDOMServer from "react-dom/server";
import createError from "http-errors";
import escape from "../../utils/escape";
import isPageFound from "../../isPageFound";
import {renderToString} from "@credo-js/html-head/react/index";
import App from "./App";
import {loaded, load, component} from "@credo-js/loadable/react";
import {debug} from "@credo-js/utils/srv/index";
import {default as createPageStore} from "../app/createPageStore";

function element(source: string | HtmlNode): ReactElement | string {
	if(typeof source === "string") {
		return source;
	}
	const {attributes = {}, html} = source;
	if(html) {
		attributes.dangerouslySetInnerHTML = {__html: html};
	}
	return createElement(source.name, attributes);
}

export default class HtmlDocumentRenderReact implements Render.HtmlDocumentInterface<ElementType> {

	public headSource: (string | ReactElement)[] = [];
	public bodySource: (string | ReactElement)[] = [];

	public name: Render.HTMLDriver = "react";
	public ssr: boolean = true;
	public doctype: string = "html";
	public title: string = "Document";
	public language: string | null = null;
	public charset: string | null = "utf-8";
	public htmlAttributes: any = {};
	public noscriptBanner: string | null = null;
	public getQueryId: string = "query";
	public baseUrl: string = "/";
	public scripts: string[] = [];
	public styles: string[] = [];

	public loader: Page.Loader<ElementType> = {loaded, load, component};

	constructor(public page: Render.PageFound | Render.PageNotFound) {}

	async toHTML(
		ctx: Context,
		api: API.ApiInterface<ElementType> | null,
		emit: <T extends {type: string} = any>(event: T) => Promise<T>
	): Promise<string> {

		const {doctype, getQueryId, language, charset, noscriptBanner, styles = [], scripts = []} = this;
		const toHtml = ReactDOMServer.renderToStaticMarkup;
		const append = (element: string | ReactElement) => {
			if(typeof element === "string") {
				return element;
			} else {
				return toHtml(element);
			}
		};

		const registered: string[] = [];
		const isHead = (name: string) => registered.includes(name);
		const loadableContext: string[] = [];

		let html = "";
		let rootDiv = '<div id="root">';

		// render app
		if(this.ssr && api) {

			const location: string = ctx.url || "/";
			const headTags: HeadTag[] = [];
			const context: any = {};

			try {
				if(isPageFound(this.page)) {
					const {page: pageComponent, props = {}, data = {}} = this.page.response;
					if(!loaded(pageComponent)) {
						await load(pageComponent);
					}
					api.page.setResponse({
						page: pageComponent,
						props,
						data,
					}, location);
				} else {
					const message = this.page.message || ctx.store.translate("system.page.unknownError", "Unknown error");
					const err = createError(this.page.code || 500, message);
					api.page.setError(err, location);
				}

				const prepareEvn = await emit({
					type: "ssr:prepare",
					App: App,
					props: {api, context, location, headTags, loadableContext},
				});

				const html = ReactDOMServer.renderToString(createElement(prepareEvn.App, prepareEvn.props));
				const renderEvn = await emit({
					type: "ssr:complete",
					html,
				});

				rootDiv += renderEvn.html;
			} catch(err) {
				debug.error("server render failure", err);
				html += `<!-- server render error: ${escape((err as Error).message || "Unknown error")} -->`;
				this.ssr = false;
			}

			// no errors
			if(this.ssr) {
				headTags.forEach((tag) => {
					const {type} = tag;
					if(!registered.includes(type)) {
						registered.push(type);
					}
				});
				this.injectHead(renderToString(headTags));
				// page:render
			}
		} else {
			this.ssr = false;
		}

		rootDiv += '</div>';

		if(!this.ssr) {
			let banner = noscriptBanner;
			if(!banner) {
				banner = ctx.store.translate("system.page.noscriptBanner", "You need to enable JavaScript to run this app.");
			}
			rootDiv += `<noscript>${banner}</noscript>`;
		}

		if(doctype) {
			html += `<!doctype ${doctype}>`;
		}

		html += '<html';

		// add html attributes
		const htmlAttributes = {... this.htmlAttributes};
		const htmlAttributesKeys = Object.keys(htmlAttributes);

		if(typeof language === "string" && !htmlAttributesKeys.includes("lang")) {
			htmlAttributesKeys.push("lang");
			htmlAttributes.lang = language;
		}

		if(htmlAttributesKeys.length) {
			const attr = toHtml(createElement("html", htmlAttributes));
			let end = attr.indexOf('/>');
			if(end === -1) {
				end = attr.indexOf('>');
			}
			if(end > 8) {
				html += attr.substring(5, end);
			}
		}

		html += '><head>';

		// head data
		if(!isHead("charset") && charset) {
			html += toHtml(createElement("meta", {charSet: charset}));
		}

		if(!isHead("viewport")) {
			html += toHtml(createElement("meta", {
				name: "viewport",
				content: "width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0",
			}));
		}

		if(!isHead("title")) {
			const title = isPageFound(this.page) ? this.page.response?.data?.title : this.page.message;
			html += toHtml(createElement("title", {}, typeof title === "string" ? title : this.title));
		}

		if(styles && styles.length > 0) {
			styles.forEach(href => {
				html += toHtml(createElement("link", {href, rel: "stylesheet"}));
			});
		}
		this.headSource.map(e => { html += append(e); });

		html += '</head><body>';

		// body data
		const toJson = (id: string, data: any) => {
			return toHtml(createElement("script", {id, type: "application/json", dangerouslySetInnerHTML: {__html: JSON.stringify(data)}}, ));
		};

		const {found = isPageFound(this.page), ... page} = this.page;

		html += rootDiv;
		html += toJson("app-page", (
			await emit({
				type: "data",
				data: {
					found,
					language,
					ssr: this.ssr,
					getQueryId,
					title: this.title,
					baseUrl: this.baseUrl,
					state: ctx.store.state,
					loadable: this.ssr && loadableContext.length > 0 ? loadableContext : [],
					... page
				}
			})
		).data);

		if(scripts && scripts.length > 0) {
			scripts.forEach(src => {
				html += toHtml(createElement("script", {src}));
			})
		}

		this.bodySource.map(e => { html += append(e); });

		html += '</body></html>';

		return html;
	}

	injectBody(source: string | HtmlNode): void {
		this.headSource.push(element(source));
	}

	injectHead(source: string | HtmlNode): void {
		this.headSource.push(element(source));
	}

	createPageStore(http: AxiosInstance): Page.StoreInterface<ElementType> {
		return createPageStore(http);
	}
}
