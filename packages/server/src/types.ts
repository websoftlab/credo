import type { Job as JobSchedule, RecurrenceSpecDateRange, RecurrenceSpecObjLit } from "node-schedule";
import type Koa from "koa";
import type { Options as KoaBodyparserOptions } from "koa-bodyparser";
import type { RedisClientOptions } from "redis";
import type { opts as KoaSessionOptions } from "koa-session";
import type { Debugger } from "@phragon/cli-debug";
import type { OnMakeURLHook } from "@phragon/make-url";
import type { PatternInterface } from "@phragon/path-to-pattern";
import type { Worker as WorkerThreads } from "worker_threads";
import type { Worker as WorkerCluster } from "cluster";
import type { BootManager } from "./phragon";
import type { LocalStoreData } from "./store";
import type { Stats } from "fs";
import type { PhragonJSCmd, OnBuildHook, CommanderCtor } from "./cmd/types";
import type { RouteManager } from "./route";
import type { Command } from "@phragon/cli-commander";
import type { Promisify } from "./helpTypes";
import type { RedisCache } from "./redis";

export type EnvMode = "development" | "production";

export { PhragonJSCmd, OnBuildHook, CommanderCtor };

interface PType {
	id: string;
	mid: number;
}

export interface PhragonServices {
	[key: string]: any;
}

export interface PhragonControllers {
	[key: string]: any;
}

export interface PhragonResponders {
	[key: string]: Route.Responder;
}

export interface PhragonExtraMiddleware {
	[key: string]: Route.ExtraMiddlewareFunction;
}

export interface PhragonJSGlobal {
	readonly mode: string;
	readonly envMode: EnvMode;
	readonly loaded: boolean;
	store: LocalStoreData;
	config: ConfigHandler;
	define(name: string, value: any): void;
	define(name: string, value: Function | Function[], getterAndSetter: true): void;
	hooks: Server.HooksInterface;
	debug: Debugger;
	language: string;
	languages: string[];
	multilingual: boolean;
	env: Env;
	services: PhragonServices;
	cache?: RedisCache;
	worker?: WorkerCluster;
	workerData?: Worker.Data;
	process?: PType;
	isApp(this: PhragonJSGlobal): this is PhragonJS;
	isCron(this: PhragonJSGlobal): this is PhragonJSCron;
	isCmd(this: PhragonJSGlobal): this is PhragonJSCmd;
	[key: string]: any;
}

export interface PhragonJS extends PhragonJSGlobal {
	readonly mode: "app";
	readonly ssr: boolean;
	app: Koa;
	renderHTMLDriver: string | null;
	route: RouteManager;
	controllers: PhragonControllers;
	responders: PhragonResponders;
	middleware: PhragonExtraMiddleware;
	cronWorker?: WorkerThreads;
}

export interface PhragonJSCron extends PhragonJSGlobal {
	readonly mode: "cron";
	cron: Record<string, Cron.Worker>;
	cronMode: Omit<Cron.Mode, "disabled">;
}

// Env
export interface EnvVar extends Record<string, Function> {
	readonly value: any;
	readonly originValue: any;
	toString(): this;
	default(value: any): this;
	map(): this;
	required(required?: boolean): this;
	convertFromBase64(): this;
	toArray(delimiter?: string | RegExp): this;
	toInt(): this;
	toIntPositive(): this;
	toIntNegative(): this;
	toFloat(): this;
	toFloatPositive(): this;
	toFloatNegative(): this;
	toJson(): this;
	toJsonArray(): this;
	toJsonObject(): this;
	toBool(): this;
	toPortNumber(): this;
	toUrlObject(): this;
	toUrlString(): this;
	toRegExp(flags?: string): this;
}

export type Env = Record<string, EnvVar> & {
	set(name: string, value: any): Env;
	get(...names: string[]): EnvVar;
	all(): any;
};

export interface ConfigHandler {
	<T extends object = any>(name: string, def?: Partial<T>, env?: Env): T;
	(name: "redis", def?: Partial<Config.Redis>): Config.Redis;
	(name: "koa/body-parser", def?: Partial<Config.KoaBodyParser>): Config.KoaBodyParser;
	(name: "koa/session", def?: Partial<Config.KoaSession>): Config.KoaSession;
	(name: "config", def?: Partial<Config.Config>): Config.Config;
	(name: "routes", def?: Partial<Config.Route>): Config.Route;
	(name: "middleware", def?: Partial<Config.Middleware>): Config.Middleware;
	(name: "cron", def?: Partial<Config.Cron>): Config.Cron;
	(name: "lexicon", def?: Partial<Config.Lexicon>): Config.Lexicon;
}

// Config
export namespace Config {
	export interface Config {
		secret: string | string[];
		store?: any;
		dataPath?: string | Record<EnvMode, string>;
	}

	export interface Lexicon {
		language: string;
		multilingual?: boolean;
		languages?: string[];
	}

	export interface Route {
		host?: string | string[];
		name?: string;
		responder?: string;
		path?: string;
		controller?: string;
		details?: any;
		middleware?: RouteConfig.ExtraMiddlewareType[];
		route404?: RouteConfig.EmptyRoute;
		sort?: "native" | "pattern";
		routes: RouteConfig.Route[];
	}

	export interface Middleware {
		depths?: Record<string, number>;
		middleware: Route.MiddlewareFunction[];
	}

	export type Cron = {
		enabled?: boolean;
		jobs: Array<Cron.Job | Cron.Service>;
	};

	export interface Redis extends RedisClientOptions {
		enabled?: boolean;
	}

	export interface KoaBodyParser extends KoaBodyparserOptions {}

	export interface KoaSession extends KoaSessionOptions {
		enabled?: boolean;
		redis?: boolean | RedisClientOptions;
	}
}

// Server
export namespace Server {
	export type HookName = string;

	export type HookListener<Event = any, Name extends string = string> =
		| ((event: Event & { name: Name }) => Promisify<void>)
		| (() => Promisify<void>);

	export type HookUnsubscribe = () => void;

	export interface HooksInterface {
		has(action: HookName, listener?: HookListener): boolean;

		subscribe<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		subscribe(action: HookName[], listener: HookListener): HookUnsubscribe;
		subscribe(action: "onBuild", event: HookListener<OnBuildHook, "onBuild">): HookUnsubscribe;
		subscribe(action: "onLoad", event: HookListener<OnLoadHook, "onLoad">): HookUnsubscribe;
		subscribe(action: "onBoot", event: HookListener<OnBootHook, "onBoot">): HookUnsubscribe;
		subscribe(action: "onMakeURL", event: HookListener<OnMakeURLServerHook, "onMakeURL">): HookUnsubscribe;
		subscribe(action: "onAppState", event: HookListener<OnAppStateHook, "onAppState">): HookUnsubscribe;
		subscribe(action: "onResponse", event: HookListener<OnResponseHook, "onResponse">): HookUnsubscribe;
		subscribe(
			action: "onResponseRoute",
			event: HookListener<OnResponseRouteHook, "onResponseRoute">
		): HookUnsubscribe;
		subscribe(
			action: "onResponseComplete",
			event: HookListener<OnResponseCompleteHook, "onResponseComplete">
		): HookUnsubscribe;
		subscribe(
			action: "onResponseController",
			event: HookListener<OnResponseControllerHook, "onResponseController">
		): HookUnsubscribe;
		subscribe(
			action: "onResponseError",
			event: HookListener<OnResponseErrorHook, "onResponseError">
		): HookUnsubscribe;

		once<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		once(action: HookName[], listener: HookListener): HookUnsubscribe;
		once(action: "onBuild", event: HookListener<OnBuildHook, "onBuild">): HookUnsubscribe;
		once(action: "onLoad", event: HookListener<OnLoadHook, "onLoad">): HookUnsubscribe;
		once(action: "onBoot", event: HookListener<OnBootHook, "onBoot">): HookUnsubscribe;
		once(action: "onMakeURL", event: HookListener<OnMakeURLServerHook, "onMakeURL">): HookUnsubscribe;
		once(action: "onAppState", event: HookListener<OnAppStateHook, "onAppState">): HookUnsubscribe;
		once(action: "onResponse", event: HookListener<OnResponseHook, "onResponse">): HookUnsubscribe;
		once(action: "onResponseRoute", event: HookListener<OnResponseRouteHook, "onResponseRoute">): HookUnsubscribe;
		once(
			action: "onResponseComplete",
			event: HookListener<OnResponseCompleteHook, "onResponseComplete">
		): HookUnsubscribe;
		once(
			action: "onResponseController",
			event: HookListener<OnResponseControllerHook, "onResponseController">
		): HookUnsubscribe;
		once(action: "onResponseError", event: HookListener<OnResponseErrorHook, "onResponseError">): HookUnsubscribe;

		emit(action: HookName): Promise<void>;
		emit<T = any>(action: HookName, event: T): Promise<void>;
		emit(action: "onBuild", event: OnBuildHook): Promise<void>;
		emit(action: "onLoad", event: OnLoadHook): Promise<void>;
		emit(action: "onBoot", event: OnBootHook): Promise<void>;
		emit(action: "onMakeURL", event: OnMakeURLServerHook): Promise<void>;
		emit(action: "onAppState", event: OnAppStateHook): Promise<void>;
		emit(action: "onResponse", event: OnResponseHook): Promise<void>;
		emit(action: "onResponseRoute", event: OnResponseRouteHook): Promise<void>;
		emit(action: "onResponseComplete", event: OnResponseCompleteHook): Promise<void>;
		emit(action: "onResponseController", event: OnResponseControllerHook): Promise<void>;
		emit(action: "onResponseError", event: OnResponseErrorHook): Promise<void>;
	}

	export interface Options extends Record<string, any> {
		process?: PType;
		publicPath?: string[];
		host?: string;
		port?: string | number;
		devServerPort?: string | number;
		mode?: EnvMode;
		cronMode?: Cron.Mode;
		registrar?: BootManager;
		workerData?: Worker.Data;
		renderHTMLDriver?: string | null;
		ssr?: boolean;
	}
}

// Workers
export namespace Worker {
	export interface Cluster extends PType {
		mode: "cron" | "app";
		count: number;
		env?: Record<string, string>;
	}

	export interface Data extends PType {
		pid: number;
		part: number;
		mode: "app" | "cron";
		numberOfRestarts: number;
	}

	export interface Worker {
		limit?: number | string;
		env?: Record<string, string>;
		data?: Data;
		cron?: boolean;
	}
}

// Routes
export namespace RouteConfig {
	interface RouteBase {
		group?: boolean;
		cache?: Cache;
		details?: any;
		middleware?: ExtraMiddlewareType[];
		routes?: Route[];
	}

	export type ExtraMiddlewareType<MProps = any> = string | [string, MProps] | [null, string];

	export type NRCPType<RProps = any, CProps = any, Details = any> =
		| string
		| [string, RProps]
		| [string, RProps, CProps]
		| [string, RProps, CProps, Details];

	export type Method = string | string[];

	export interface PathHandler<Params extends { [K in keyof Params]?: string } = {}> {
		type: "handler";
		handler: string | ((ctx: Koa.Context, match: any) => Promisify<string | Params | false | null>);
		pattern?: string;
	}
	export interface PathDynamic<Params extends { [K in keyof Params]?: string } = {}> {
		type: "dynamic";
		service?: string;
		match?: Route.Match<Params>;
		matchToPath?: Route.MatchToPath<Params>;
	}
	export interface PathPattern {
		type: "pattern";
		pattern: string;
	}

	export type Path<Params extends { [K in keyof Params]?: string } = {}> =
		| string
		| PathHandler<Params>
		| PathDynamic<Params>
		| PathPattern;

	export type Route =
		| NRCPType
		| (RouteBase & {
				method?: Method;
				name?: string;
				responder?: string | [string, any];
				path?: Path;
				controller?: Controller;
		  })
		| (RouteBase & {
				nrcp: string; // [method:]name@responder[|path|controller]
		  });

	export type EmptyRoute =
		| NRCPType
		| (Omit<RouteBase, "routes" | "group"> & {
				method?: Method;
				name?: string;
				responder?: string | [string, any];
				controller?: Controller;
		  })
		| (Omit<RouteBase, "routes" | "group"> & {
				nrcp: NRCPType;
		  });

	export type Cache = boolean | number | "body" | "controller" | Partial<Route.CacheOptions>;

	export type Controller<ControllerProps = any, ControllerResult = any> =
		| string
		| [string, ControllerProps]
		| Route.ControllerFunction<ControllerProps, ControllerResult>;
}

export namespace Route {
	export type MatchToPath<Params extends { [K in keyof Params]?: string } = {}> = (
		params: Params | undefined,
		ctx: Koa.Context
	) => Promisify<string>;

	export type Match<Params extends { [K in keyof Params]?: string } = {}> = (
		ctx: Koa.Context
	) => Promisify<Params | false>;

	export interface RoutePattern {
		pattern?: PatternInterface;
		match: Match;
		methods: string[];
		context: Context;
	}

	export interface RouteGroup {
		methods?: string[];
		path: string;
		routes?: Route[];
	}

	export interface RouteDynamic extends Omit<RoutePattern, "pattern"> {
		matchToPath?: MatchToPath;
		length?: number | (() => number);
	}

	export type Route = RoutePattern | RouteGroup | RouteDynamic;

	export type RouteEmpty = Omit<RoutePattern, "match" | "pattern">;

	export interface CacheOptions {
		ttl: number;
		cacheable: (ctx: Koa.Context) => Promisify<boolean>;
		getKey: (ctx: Koa.Context) => Promisify<string>;
		mode: "body" | "controller";
	}

	export interface MiddlewareFunction {
		(ctx: Koa.Context, next: Koa.Next): Promisify<void>;
		name?: string;
		depth?: number;
	}

	export type ControllerFunction<ControllerProps = any, ControllerResult = any> = (
		ctx: Koa.Context,
		props?: ControllerProps
	) => Promisify<ControllerResult>;

	export interface Context<ControllerProps = any, ResponderProps = any, RouteDetails = any> {
		name: string;
		cache?: CacheOptions;
		details?: RouteDetails;
		middleware?: ExtraMiddleware[];
		controller: {
			name: string | symbol;
			handler?: ControllerFunction<ControllerProps, ResponderProps>;
			props?: ControllerProps;
		};
		responder: {
			name: string;
			props?: ResponderProps;
		};
	}

	export type ResponderFunction<ControllerResult = any, ResponderProps = any> = (
		ctx: Koa.Context,
		result: ControllerResult,
		props?: ResponderProps
	) => Promisify<void>;

	export interface Responder<ControllerResult = any, ResponderProps = any> {
		name: string;
		middleware?: (ctx: Koa.Context, next: Koa.Next) => Promisify<void>;
		error?: (ctx: Koa.Context, error: Error) => Promisify<void>;
		depth?: number;
		responder: ResponderFunction<ControllerResult, ResponderProps>;
	}

	export interface ExtraMiddleware<MProps = any> {
		name: string;
		props?: MProps;
	}

	export type ExtraMiddlewareFunction<MProps = never> = (
		ctx: Koa.Context,
		next: Koa.Next,
		props?: MProps
	) => Promisify<void>;
}

export namespace Ctor {
	type CtorHandler<Result = void, Opt = unknown> = (phragon: PhragonJS, options?: Opt) => Promisify<Result>;

	export type Commander<Opt = unknown> = (phragon: PhragonJSCmd, command: Command, opt?: Opt) => void;

	export type Controller<ControllerFunc = Function, Opt = unknown> = CtorHandler<ControllerFunc, Opt>;

	export type Service<ServiceFunc = Function, Opt = unknown> = CtorHandler<ServiceFunc, Opt>;

	export type Bootstrap<Opt = unknown> = CtorHandler<Function | void, Opt>;

	export type Middleware<Opt = unknown> = Route.MiddlewareFunction | CtorHandler<Route.MiddlewareFunction, Opt>;

	export type Responder<Conf = unknown> = (phragon: PhragonJS, name: string, config?: Conf) => Route.Responder;

	export type ExtraMiddleware<MProps = unknown> =
		| Route.ExtraMiddlewareFunction
		| ((phragon: PhragonJS) => Promisify<Route.ExtraMiddlewareFunction<MProps>>);
}

// Cron
export namespace Cron {
	type Base = {
		name?: string;
		rule: string | RecurrenceSpecDateRange | RecurrenceSpecObjLit | Date;
		bootstrap?: boolean;
		overload?: Overload;
		overloadTimeout?: number;
	};

	export type Overload = "ignore" | "abort" | "wait";

	export type Mode = "service" | "disabled" | "worker";

	export interface Worker {
		readonly name: string;
		readonly job: JobSchedule;
		readonly started: number;
		readonly completed: number;
		readonly errors: number;
	}

	export interface Job extends Base {
		job(date: Date): Promisify<void>;
	}

	export interface Service extends Base {
		service: string;
		args?: any[];
	}
}

// local store
export namespace LocalStore {
	export type FStats = {
		base: string;
		file: string;
		path: string | null;
		fullPath: string;
		stats: Stats;
	};

	export type ReadOptions<R = string> = {
		live?: (name: string, data: R) => boolean;
		builder?: () => Promisify<R>;
		json?: boolean;
	};

	export type RequireOptions<R = any> = {
		builder?: () => Promisify<string>;
		clearCache?: boolean;
		hash?: [keyof R, string];
	};

	export type ListOptions = {
		path?: string;
		depth?: number;
		mask?: string | RegExp | ((file: string, path: string | null) => boolean);
		hidden?: boolean;
	};
}

// hooks
export interface CtxHook {
	ctx: Koa.Context;
}
export interface OnMakeURLServerHook extends OnMakeURLHook, CtxHook {
	name?: string;
}
export interface OnAppStateHook<State = any> extends CtxHook {
	ctx: Koa.Context;
	state: State;
}
export interface OnResponseHook extends CtxHook {}
export interface OnResponseRouteHook extends CtxHook {
	notFound: boolean;
}
export interface OnResponseCompleteHook extends CtxHook {}
export interface OnResponseControllerHook<Result = any> extends CtxHook {
	result: Result;
}
export interface OnResponseErrorHook extends CtxHook {
	route?: Route.Context;
	code?: string;
	error: Error;
}
export interface OnLoadHook {
	complete(handler: Function): void;
}
export interface OnBootHook {}
