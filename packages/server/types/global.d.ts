import type { CredoJS, Route, Worker as WorkerCJS } from "@credo-js/server/types";
import type { AppStore } from "@credo-js/app";
import type { URL } from "@credo-js/make-url";

declare global {
	export var credo: CredoJS;
}

declare module "@credo-js/make-url" {
	namespace URL {
		interface Options {
			name?: string;
		}
	}
}

declare module "cluster" {
	interface Worker {
		workerData?: WorkerCJS.Data;
	}
}

declare module "koa" {
	interface Context {
		readonly credo: CredoJS;

		// lexicon extension
		readonly multilingual: boolean;
		readonly defaultLanguage: string;
		readonly languages: string[];
		language: string;

		// url
		makeUrl: URL.AsyncHandler;

		// app
		readonly store: AppStore;
		readonly isBodyEnded: boolean;
		bodyEnd(body?: any, statusCode?: number, type?: string): boolean;

		// router
		redirectToRoute<P = any>(name: string, params?: P): Promise<void>;
		match?: Record<string, any>;
		route?: Route.Context;
		cacheable?: boolean;
		cached?: boolean;
	}
}
