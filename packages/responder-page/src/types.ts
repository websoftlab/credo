import type {Context} from "koa";
import type HtmlDocument from "./HtmlDocument";
import type {default as HtmlNode} from "./HtmlNode";
import type {AxiosInstance} from "axios";
import type {Lexicon} from "@credo-js/lexicon";
import type {CtxHook, OnMakeURLHook} from "@credo-js/server";
import type {URL} from "@credo-js/make-url";

type OkCode = 200 | 201 | 202 | 203 | 205 | 206 | 207 | 208 | 226;

export type ResponderPageCtorConfig = {
	getQueryId?: string;
	baseUrl?: string;
};

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
	state?: any;
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

	export interface HtmlDocumentInterface<Type> {

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
		createPageStore(http: AxiosInstance): Page.StoreInterface<Type>;
	}
}

export namespace API {

	export interface Services extends Record<string, any> {
		http: AxiosInstance;
		translator: Lexicon.Translator;
	}

	export interface ApiInterface<ComponentType, State = any> extends Record<string, any> {
		mode: "client" | "server",
		app: Lexicon.StoreInterface<State>;
		page: Page.StoreInterface<ComponentType>;
		services: Services;
		baseUrl: string;
		title: string;
		ssr: boolean;
		makeUrl: URL.Handler;

		has(action: HookName, listener?: HookListener): boolean;

		subscribe(action: HookName[], listener: HookListener): HookUnsubscribe;
		subscribe<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		subscribe(action: "onMakeURL", event: HookListener<OnMakeURLHook>): HookUnsubscribe;

		once(action: HookName[], listener: HookListener): HookUnsubscribe;
		once<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		once(action: "onMakeURL", event: HookListener<OnMakeURLHook>): HookUnsubscribe;

		emit(action: HookName): void;
		emit<T = any>(action: HookName, event: T): void;
		emit(action: "onMakeURL", event: OnMakeURLHook): void;
	}

	export interface ApiCtor<ComponentType, State = any> {
		new (
			mode: "client" | "server",
			app: Lexicon.StoreInterface<State>,
			page: Page.StoreInterface<ComponentType>,
			services: Services,
		): ApiInterface<ComponentType>;
	}

	export type HookName = string;
	export type HookListener<Event = any> = (event?: Event) => void;
	export type HookUnsubscribe = () => void;
}

export namespace Page {

	export interface ComponentResponse<ComponentType, Data = any, Props = any> {
		Component: ComponentType;
		data: Data;
		props: Props;
	}

	export interface Response<Data = any, Props = any> {
		page: string;
		data: Data;
		props?: Props;
		code?: number;
	}

	export interface StoreCtorOptions<ComponentType> {
		http: AxiosInstance;
		loader: Loader<ComponentType>;
	}

	export interface StoreCtor<ComponentType> {
		new (options: StoreCtorOptions<ComponentType>): StoreInterface<ComponentType>;
	}

	export interface Loader<ComponentType> {
		load(name: string): Promise<void>
		loaded(name: string): boolean;
		component(name: string): ComponentType;
	}

	export interface StoreInterface<ComponentType> {
		readonly id: symbol;
		readonly url: string;
		readonly key: string;
		readonly code: number;
		readonly response: ComponentResponse<ComponentType> | null;
		readonly loading: boolean;
		readonly error: boolean;
		readonly errorMessage: string | null;
		readonly title: string;

		loadDocument(page: Response, url?: string, key?: string): void;
		load(url: string, key: string): void;
		setError(err: Error, url?: string, key?: string): void;
		setResponse(response: Response, url?: string, key?: string): void;
	}

	export interface DocumentAppOptions {
		ssr: boolean;
		getQueryId?: string;
		baseUrl?: string;
		title?: string;
		language?: string;
		loadable?: string[];
		state: any;
		found: boolean;
		response?: Response;
		message?: string;
		code?: number;
	}
}

export interface HttpJsonServiceOptions {
	getQueryId?: string,
	host?: string,
	protocol?: string,
}

// hooks

export interface OnAppStateHook<State = any> extends CtxHook { state: State }

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

