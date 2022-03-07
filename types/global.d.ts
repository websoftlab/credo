import type {CredoJS, Config, Route, Worker as WorkerFJS} from "@credo-js/server";
import type {AxiosRequestConfig} from "axios";
import type {Lexicon} from "@credo-js/lexicon";
import type {URL} from "@credo-js/make-url";
import type {CredoExtraFavicon} from "@credo-js/extra";

// for all

declare global {
	export var __DEV__: boolean;
	export var __DEV_SERVER__: boolean;
	export var __PROD__: boolean;
	export var __BUNDLE__: string;
	export var __SSR__: boolean;
	export var credo: CredoJS;
}

// @credo-js/responder-page

declare module "axios" {
	export interface AxiosRequestConfig {
		isPage?: boolean;
	}
}

// @credo-js/server

declare module 'cluster' {
	interface Worker {
		workerData?: WorkerFJS.Data;
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

// @credo-js/extra

declare module "@credo-js/server" {
	namespace Config {
		export interface Config {
			favicon?: CredoExtraFavicon;
		}
	}
}