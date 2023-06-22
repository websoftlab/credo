import HtmlNode from "./HtmlNode";
import { PageStore, Api, createHttpJsonService } from "@phragon/app";
import type { Context } from "koa";
import type { Render } from "./types";

const LISTENER_KEY = Symbol();
const RENDER_DRIVER_KEY = Symbol();

type HtmlDocumentListener<T extends { type: string }> = (event: T) => void | Promise<void>;

function drv(document: HtmlDocument): Render.HtmlDriverInterface<any> {
	return document[RENDER_DRIVER_KEY];
}

export default class HtmlDocument {
	get doctype(): string {
		return drv(this).doctype;
	}
	get title(): string {
		return drv(this).title;
	}
	get language(): string | null {
		return drv(this).language;
	}
	get charset(): string | null {
		return drv(this).charset;
	}
	get htmlAttributes(): any {
		return drv(this).htmlAttributes;
	}
	get noscriptBanner(): string | null {
		return drv(this).noscriptBanner;
	}
	get viewport(): string | null {
		return drv(this).viewport;
	}
	get autoMetaTags(): string[] {
		return drv(this).autoMetaTags;
	}
	get getQueryId(): string {
		return drv(this).getQueryId;
	}
	get ssr(): boolean {
		return drv(this).ssr;
	}
	get baseUrl(): string {
		return drv(this).baseUrl;
	}
	get scripts(): string[] {
		return drv(this).scripts;
	}
	get styles(): string[] {
		return drv(this).styles;
	}

	set doctype(value: string) {
		drv(this).doctype = value;
	}
	set title(value: string) {
		drv(this).title = value;
	}
	set language(value: string | null) {
		drv(this).language = value;
	}
	set charset(value: string | null) {
		drv(this).charset = value;
	}
	set htmlAttributes(value: any) {
		drv(this).htmlAttributes = value;
	}
	set noscriptBanner(value: string | null) {
		drv(this).noscriptBanner = value;
	}
	set viewport(value: string | null) {
		drv(this).viewport = value;
	}
	set autoMetaTags(value: string[]) {
		drv(this).autoMetaTags = value;
	}
	set getQueryId(value: string) {
		drv(this).getQueryId = value;
	}
	set ssr(value: boolean) {
		drv(this).ssr = value;
	}
	set baseUrl(value: string) {
		drv(this).baseUrl = value;
	}
	set scripts(value: string[]) {
		drv(this).scripts = value;
	}
	set styles(value: string[]) {
		drv(this).styles = value;
	}

	[LISTENER_KEY]: Array<HtmlDocumentListener<any>> = [];
	[RENDER_DRIVER_KEY]: Render.HtmlDriverInterface<any>;

	constructor(driver: Render.HtmlDriverInterface<any>) {
		this[RENDER_DRIVER_KEY] = driver;
	}

	injectHead(source: string | HtmlNode) {
		drv(this).injectHead(source);
		return this;
	}
	injectHeadMeta(type: "name" | "property", value: string, content: string) {
		drv(this).injectHead(new HtmlNode("meta", { [type === "name" ? "name" : "property"]: value, content }));
		return this;
	}
	injectHeadScript(src: string) {
		return this.injectHead(new HtmlNode("script", { src }));
	}
	injectHeadEvalScript(source: string, props: any = {}) {
		return this.injectHead(new HtmlNode("script", props, source));
	}
	injectHeadLink(href: string, props?: any) {
		return this.injectHead(new HtmlNode("link", { ...props, href }));
	}
	injectHeadStyle(source: string) {
		return this.injectHead(new HtmlNode("style", { type: "text/css" }, source));
	}

	injectBody(source: string | HtmlNode) {
		drv(this).injectBody(source);
		return this;
	}
	injectBodyScript(src: string) {
		return this.injectBody(new HtmlNode("script", { src }));
	}
	injectBodyEvalScript(source: string, props: any = {}) {
		return this.injectBody(new HtmlNode("script", props, source));
	}
	injectBodyJsonScript(id: string, data: any) {
		return this.injectBody(new HtmlNode("script", { id }, JSON.stringify(data)));
	}

	on<T extends { type: string } = any>(listener: HtmlDocumentListener<T>) {
		const listeners = this[LISTENER_KEY];
		if (typeof listener === "function" && !listeners.includes(listener)) {
			listeners.push(listener);
		}
		return this;
	}

	off<T extends { type: string } = any>(listener: HtmlDocumentListener<T>) {
		const listeners = this[LISTENER_KEY];
		const index = listeners.indexOf(listener);
		if (index > -1) {
			listeners.splice(index, 1);
		}
		return this;
	}

	async toHTML(ctx: Context) {
		const driver = drv(this);
		const emit = async <T extends { type: string } = any>(event: T & { renderDriver?: string }): Promise<T> => {
			const listeners = this[LISTENER_KEY];
			event.renderDriver = driver.name;
			for (let i = 0; i < listeners.length; i++) {
				await listeners[i](event);
			}
			return event;
		};

		// http service
		const http = createHttpJsonService({
			host: ctx.host,
			protocol: ctx.secure ? "https" : "http",
		});

		const app = ctx.store;
		const page = new PageStore({ http, loader: driver.loader, buildId: app.build, buildVersion: app.version });
		await emit({ type: "server:page", page });

		const api = new Api<any>("server", ctx.store, page);
		await emit({ type: "server:api", api });

		const html = await driver.toHTML(ctx, api, emit);

		return (await emit({ type: "complete", ssr: driver.ssr, html })).html;
	}
}
