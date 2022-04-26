import type { PhragonJS, Route, Worker as WorkerCJS } from "@phragon/server/types";
import type { AppStore } from "@phragon/app";
import type { URL } from "@phragon/make-url";

declare global {
	export var phragon: PhragonJS;
}

declare module "@phragon/make-url" {
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
		readonly phragon: PhragonJS;

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
