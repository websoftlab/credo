
// URL
export namespace URL {
	export type QueryOptions = {
		nullable?: (value: any, name: string) => boolean;
	}

	export interface Options extends QueryOptions {
		path: string | string[];
		host?: string;
		port?: string | number;
		protocol?: "http" | "https";
		search?: any;
		hash?: string;
		params?: any;
		cacheable?: boolean;
	}

	export type Handler = (url: string | string[] | Options) => string;
	export type AsyncHandler = (url: string | string[] | Options) => Promise<string>;
}
