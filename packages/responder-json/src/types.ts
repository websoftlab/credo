import type {Context} from "koa";
import type HttpJSON from "./HttpJSON";

type ContextType<T> = T | ((ctx: Context) => (T | Promise<T>));

export interface ResponderJsonCorsOptions {
	enabled?: boolean;
	origin?: ContextType<string>;
	credentials?: ContextType<boolean>;
	maxAge?: string | number;
	allowHeaders?: string | string[];
	exposeHeaders?: string | string[];
	keepHeadersOnError?: boolean;
}

type HttpJsonType = Promise<HttpJSON> | HttpJSON;

export interface ResponderJsonConfigOptions {
	cors?: boolean | ResponderJsonCorsOptions;
	done?: (json: HttpJSON) => HttpJsonType;
	error?: (error: Error) => HttpJsonType;
}