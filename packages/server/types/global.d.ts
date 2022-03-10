import type {CredoJS, Route, Worker as WorkerCJS} from "../src/types";
import type {Lexicon} from "@credo-js/lexicon";
import type {URL} from "@credo-js/make-url";

declare global {
	export var credo: CredoJS;
	export var __DEV__: boolean;
	export var __DEV_SERVER__: boolean;
	export var __PROD__: boolean;
	export var __BUNDLE__: string;
	export var __SSR__: boolean;
	export var __SRV__: boolean;
	export var __WEB__: boolean;
}

declare module 'cluster' {
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
		readonly store: Lexicon.StoreInterface;

		// router
		match?: Record<string, any>;
		route?: Route.Context;
	}
}