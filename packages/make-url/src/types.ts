import type UrlPattern from "./UrlPattern";

// URL
export namespace URL {
	export type QueryOptions = {
		nullable?: (value: any, name: string) => boolean;
	};

	export interface Options extends QueryOptions {
		path?: string | string[];
		host?: string;
		port?: string | number;
		protocol?: "http" | "https";
		search?: any;
		hash?: string;
		name?: string;
		params?: any;
		cacheable?: boolean;
		pattern?: UrlPattern;
	}

	export type Handler<D = any> = (url: string | string[] | (Options & { details?: D })) => string;
	export type AsyncHandler<D = any> = (url: string | string[] | (Options & { details?: D })) => Promise<string>;
}

// Hooks
export interface OnMakeURLHook<D = any> {
	url: URL.Options;
	details?: D;
}
