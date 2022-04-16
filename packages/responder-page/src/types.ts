import type {Context} from "koa";
import type HtmlDocument from "./HtmlDocument";
import type {default as HtmlNode} from "./HtmlNode";
import type {API, Page} from "@credo-js/app";
import type {CtxHook} from "@credo-js/server";

type OkCode = 200 | 201 | 202 | 203 | 205 | 206 | 207 | 208 | 226;

export type ResponderPageResultFound<Data = any, Props = any> = {
	code: OkCode;
	data: Data;
} | {
	code: OkCode;
	response: {
		data: Data;
		page?: string;
		props?: Props;
	}
}

export type ResponderPageResultNotFound = {
	code: number;
	message: string;
}

export type ResponderPageResultRedirect = {
	code?: number;
	redirect: {
		location: string;
	}
}

export type ResponderPageResult =
	ResponderPageResultFound |
	ResponderPageResultNotFound |
	ResponderPageResultRedirect;

export type ResponderPageHandlerProps<Props = any> = {
	ssr?: boolean;
	page?: string;
	props?: Props;
}

export type ResponderPageOptions = {
	ssr?: boolean;
	baseUrl?: string;
	getQueryId?: string;
}

// Render
export namespace Render {

	// react, vue, svelte, etc.
	// native system support - react
	export type HTMLDriver = string;

	export type PageFoundResponse = {
		page: string;
		data: any;
		props: any;
	}

	export type PageFound = {
		found: true;
		code: number;
		response: PageFoundResponse;
	}

	export type PageNotFound = {
		found: false;
		code: number;
		message: string;
	}

	export interface HtmlDriverInterface<Type> {

		name: HTMLDriver;
		ssr: boolean;
		doctype: string;
		title: string;
		language: string | null;
		charset: string | null;
		htmlAttributes: Record<string, string>;
		noscriptBanner: string | null;
		getQueryId: string;
		baseUrl: string;
		scripts: string[];
		styles: string[];
		loader: Page.Loader<Type>;

		injectHead(source: string | HtmlNode): void;
		injectBody(source: string | HtmlNode): void;
		toHTML(ctx: Context, api: API.ApiInterface<Type> | null, emit: <T extends {type: string} = any>(event: T) => Promise<T>): Promise<string>;
	}
}

// hooks

export interface OnPageHTMLBeforeRenderHook extends CtxHook { document: HtmlDocument; }

export interface OnPageJSONBeforeRenderHook extends CtxHook {
	isError: boolean;
	body: {
		code: number, message: string
	} | {
		code: number, response: {
			page: string;
			data: any;
			props: any;
		}
	};
}

// utils

export interface LoadManifestOptions {
	mid?: number,
	envMode: string,
	devServerHost?: string,
	devServerPort?: number,
}