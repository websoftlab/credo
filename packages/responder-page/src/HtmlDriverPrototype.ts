import type { Render } from "./types";
import type HtmlNode from "./HtmlNode";
import type { API, Page } from "@phragon/app";
import type { Context } from "koa";

export default abstract class HtmlDriverPrototype<Type, RenderType = HtmlNode>
	implements Render.HtmlDriverInterface<Type>
{
	protected headSource: (string | RenderType)[] = [];
	protected bodySource: (string | RenderType)[] = [];

	public ssr: boolean = true;
	public doctype: string = "html";
	public title: string = "Document";
	public language: string | null = null;
	public charset: string | null = "utf-8";
	public htmlAttributes: Record<string, string> = {};
	public noscriptBanner: string | null = null;
	public getQueryId: string = "query";
	public baseUrl: string = "/";
	public scripts: string[] = [];
	public styles: string[] = [];
	public viewport: string | null =
		"width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0";
	public autoMetaTags: string[] = ["title", "charset", "viewport"];

	abstract name: Render.HTMLDriver;
	abstract loader: Page.Loader<Type>;

	protected constructor(public page: Render.PageFound | Render.PageNotFound) {}

	injectBody(source: string | HtmlNode): void {
		this.bodySource.push(this.prepareHtmlNode(source));
	}

	injectHead(source: string | HtmlNode): void {
		this.headSource.push(this.prepareHtmlNode(source));
	}

	protected prepareHtmlNode(source: string | HtmlNode): RenderType | string {
		return source as never;
	}

	abstract toHTML(
		ctx: Context,
		api: API.ApiInterface<Type> | null,
		emit: <T extends { type: string } = any>(event: T) => Promise<T>
	): Promise<string>;
}
