import type { AxiosInstance } from "axios";
import type { Lexicon } from "@phragon/lexicon";
import type { URL, OnMakeURLHook } from "@phragon/make-url";

export namespace API {
	export interface Services extends Record<string, any> {
		http: AxiosInstance;
		translator: Lexicon.Translator;
	}

	export interface ApiInterface<ComponentType, State = any> {
		mode: "client" | "server";
		app: App.StoreInterface<State>;
		page: Page.StoreInterface<ComponentType>;
		services: Services;
		baseUrl: string;
		title: string;
		ssr: boolean;
		makeUrl: URL.Handler;
		[key: string]: any;

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
			app: App.StoreInterface<State>,
			page: Page.StoreInterface<ComponentType>
		): ApiInterface<ComponentType>;
	}

	export type HookName = string;
	export type HookUnsubscribe = () => void;
	export type HookListener<Event = any, Name extends string = string> =
		| ((event: Event & { name: Name }) => void)
		| (() => void);
}

export namespace App {
	export interface StoreCtor {
		new (state?: any): StoreInterface;
	}

	export interface StoreInterface<State = any> extends Lexicon.LanguageStoreInterface {
		readonly state: State;
		update(state: any): void;
		reload(state: any): void;
	}
}

export namespace Page {
	export type ClientRenderHandler<ComponentType, RenderOptions = {}> = (
		node: HTMLElement,
		options?: ClientOptions<ComponentType, RenderOptions>
	) => Promise<void>;

	export type ClientOptions<ComponentType, RenderOptions = {}> = RenderOptions & {
		bootloader?: ((api: API.ApiInterface<ComponentType>) => void)[];
	};

	export interface DataType {
		title?: string;
	}

	export interface ResponseDataType extends DataType {
		$language?: string;
		$package?: string | string[];
		$state?: any;
	}

	export interface ComponentResponse<ComponentType, Data extends DataType = any, Props = any> {
		name: string;
		Component: ComponentType;
		data: Data;
		props: Props;
	}

	export interface Response<Data extends ResponseDataType = any, Props = any> {
		page: string;
		data: Data;
		props?: Props;
		code?: number;
	}

	export interface StoreCtorOptions<ComponentType> {
		getQueryId?: string;
		http: AxiosInstance;
		loader: Loader<ComponentType>;
	}

	export interface StoreCtor<ComponentType> {
		new (options: StoreCtorOptions<ComponentType>): StoreInterface<ComponentType>;
	}

	export interface Loader<ComponentType> {
		load(name: string): Promise<void>;
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
		readonly http: AxiosInstance;
		readonly data: any;

		setData(name: string, value: any): void;
		setData(data: any): void;
		loader(callback: (page: Response) => void | Promise<void>): () => void;
		loadDocument(page: Response, url?: string, key?: string): void;
		load(url: string, key: string, bodyPost?: any): void;
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
	host?: string;
	protocol?: string;
}
