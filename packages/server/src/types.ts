import type {Job as JobSchedule, RecurrenceSpecDateRange, RecurrenceSpecObjLit} from "node-schedule";
import type Koa from "koa";
import type {Options as KoaBodyparserOptions} from "koa-bodyparser";
import type {RedisClientOptions} from "redis";
import type {opts as KoaSessionOptions} from "koa-session";
import type {Debugger} from "@credo-js/cli-debug";
import type {OnMakeURLHook} from "@credo-js/make-url";
import type {PatternInterface} from "@credo-js/path-to-pattern";
import type {Worker as WorkerThreads} from "worker_threads";
import type {Worker as WorkerCluster} from "cluster";
import type {BootManager} from "./credo";
import type {LocalStoreData} from "./store";
import type {Stats} from "fs";
import type {CredoJSCmd, OnBuildHook, CommanderCtor} from "./cmd/types";
import type {RouteManager} from "./RouteManager";

export type EnvMode = "development" | "production";

export {CredoJSCmd, OnBuildHook, CommanderCtor};

interface PType {
	id: string;
	mid: number;
}

export interface CredoServices {
	[key: string]: any;
}

export interface CredoControllers {
	[key: string]: any;
}

export interface CredoResponders {
	[key: string]: Route.Responder;
}

export interface CredoExtraMiddleware {
	[key: string]: Route.ExtraMiddlewareFunction;
}

export interface CredoJSGlobal {
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
	services: CredoServices;
	cache?: any;
	worker?: WorkerCluster;
	workerData?: Worker.Data;
	process?: PType;
	isApp(this: CredoJSGlobal): this is CredoJS;
	isCron(this: CredoJSGlobal): this is CredoJSCron;
	isCmd(this: CredoJSGlobal): this is CredoJSCmd;
	[key: string]: any;
}

export interface CredoJS extends CredoJSGlobal {
	readonly mode: "app";
	readonly ssr: boolean;
	app: Koa;
	renderHTMLDriver: string | null;
	route: RouteManager;
	controllers: CredoControllers;
	responders: CredoResponders;
	middleware: CredoExtraMiddleware;
	cronWorker?: WorkerThreads;
}

export interface CredoJSCron extends CredoJSGlobal {
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
	get(... names: string[]): EnvVar;
	all(): any;
}

export interface ConfigHandler {
	<T extends object = any>(name: string, def?: Partial<T>): T;
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
		middleware?: Route.ExtraMiddlewareType[];
		route404?: Route.EmptyRoute;
		sort?: "native" | "pattern";
		routes: Route.Route[];
	}

	export interface Middleware {
		depths?: Record<string, number>;
		middleware: Route.MiddlewareFunction[];
	}

	export type Cron = {
		enabled?: boolean;
		jobs: Array<Cron.Job | Cron.Service>;
	}

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

	export type HookListener<Event = any, Name extends string = string> = ((event: Event & {name: Name}) => void | Promise<void>) | (() => void | Promise<void>);

	export type HookUnsubscribe = () => void;

	export interface HooksInterface {
		has(action: HookName, listener?: HookListener): boolean;

		subscribe<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		subscribe(action: HookName[], listener: HookListener): HookUnsubscribe;
		subscribe(action: "onBuild", event: HookListener<OnBuildHook, "onBuild">): HookUnsubscribe;
		subscribe(action: "onLoad", event: HookListener<OnLoadHook, "onLoad">): HookUnsubscribe;
		subscribe(action: "onBoot", event: HookListener<OnBootHook, "onBoot">): HookUnsubscribe;
		subscribe(action: "onMakeURLServer", event: HookListener<OnMakeURLServerHook, "onMakeURLServer">): HookUnsubscribe;
		subscribe(action: "onAppState", event: HookListener<OnAppStateHook, "onAppState">): HookUnsubscribe;
		subscribe(action: "onResponse", event: HookListener<OnResponseHook, "onResponse">): HookUnsubscribe;
		subscribe(action: "onResponseRoute", event: HookListener<OnResponseRouteHook, "onResponseRoute">): HookUnsubscribe;
		subscribe(action: "onResponseComplete", event: HookListener<OnResponseCompleteHook, "onResponseComplete">): HookUnsubscribe;
		subscribe(action: "onResponseController", event: HookListener<OnResponseControllerHook, "onResponseController">): HookUnsubscribe;
		subscribe(action: "onResponseError", event: HookListener<OnResponseErrorHook, "onResponseError">): HookUnsubscribe;

		once<T = any>(action: HookName, listener: HookListener<T>): HookUnsubscribe;
		once(action: HookName[], listener: HookListener): HookUnsubscribe;
		once(action: "onBuild", event: HookListener<OnBuildHook, "onBuild">): HookUnsubscribe;
		once(action: "onLoad", event: HookListener<OnLoadHook, "onLoad">): HookUnsubscribe;
		once(action: "onBoot", event: HookListener<OnBootHook, "onBoot">): HookUnsubscribe;
		once(action: "onMakeURLServer", event: HookListener<OnMakeURLServerHook, "onMakeURLServer">): HookUnsubscribe;
		once(action: "onAppState", event: HookListener<OnAppStateHook, "onAppState">): HookUnsubscribe;
		once(action: "onResponse", event: HookListener<OnResponseHook, "onResponse">): HookUnsubscribe;
		once(action: "onResponseRoute", event: HookListener<OnResponseRouteHook, "onResponseRoute">): HookUnsubscribe;
		once(action: "onResponseComplete", event: HookListener<OnResponseCompleteHook, "onResponseComplete">): HookUnsubscribe;
		once(action: "onResponseController", event: HookListener<OnResponseControllerHook, "onResponseController">): HookUnsubscribe;
		once(action: "onResponseError", event: HookListener<OnResponseErrorHook, "onResponseError">): HookUnsubscribe;

		emit(action: HookName): Promise<void>;
		emit<T = any>(action: HookName, event: T): Promise<void>;
		emit(action: "onBuild", event: OnBuildHook): Promise<void>;
		emit(action: "onLoad", event: OnLoadHook): Promise<void>;
		emit(action: "onBoot", event: OnBootHook): Promise<void>;
		emit(action: "onMakeURLServer", event: OnMakeURLServerHook): Promise<void>;
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
		mode: "cron" | "app",
		count: number,
		env?: Record<string, string>,
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
export namespace Route {

	type RouteBase = {
		cache?: Cache;
		details?: any;
		middleware?: ExtraMiddlewareType[];
		routes?: Route[];
	};

	export type NRPCType<RProps = any, CProps = any, Details = any> =
		string |
		[string, RProps] |
		[string, RProps, CProps] |
		[string, RProps, CProps, Details];

	export type Method = string | string[];

	export type Path<Params extends { [K in keyof Params]?: string } = {}> =
		string |
		[string, (string | ( (ctx: Koa.Context, match: any) => boolean | Promise<boolean> ))] |
		((ctx: Koa.Context) => (string | Params | false | null | Promise<string | Params | false | null>));

	export type Route =
		NRPCType |
		RouteBase & {
			method?: Method;
			name?: string;
			responder?: string | [string, any];
			path?: Path;
			controller: Controller;
		} |
		RouteBase & {
			nrpc: string; // [method:]name@responder[|path|controller]
		}

	export type EmptyRoute =
		NRPCType |
		Omit<RouteBase, "routes"> & {
			method?: Method;
			name?: string;
			responder?: string | [string, any];
			controller: Controller;
		} |
		Omit<RouteBase, "routes"> & {
			nrpc: NRPCType;
		}

	export type PointMatch<Params extends { [K in keyof Params]?: string } = {}> = (ctx: Koa.Context) => (Params | false | Promise<Params | false>);
	export type Point = {
		pattern?: PatternInterface;
		match: PointMatch;
		methods: string[];
		context: Context;
	}

	export type EmptyPoint = Omit<Point, "match" | "pattern">;

	export type NRPCDecode<CProps = any, RProps = any, Details = any> = {
		method?: Method;
		details?: Details;
		name: string;
		responder: string | [string, RProps];
		path: string;
		controller: string | [string, CProps];
	}

	export type CacheOptions = {
		ttl: number;
		cacheable: (ctx: Koa.Context) => boolean | Promise<boolean>;
		getKey: (ctx: Koa.Context) => string | Promise<string>;
		mode: "body" | "controller";
	}

	export type Cache = boolean | number | "body" | "controller" | Partial<CacheOptions>

	export interface MiddlewareFunction {
		(ctx: Koa.Context, next: Koa.Next): (void | Promise<void>);
		name?: string;
		depth?: number;
	}

	export type ControllerFunction<ControllerProps = any, ControllerResult = any> = (
		(ctx: Koa.Context, props?: ControllerProps) => (ControllerResult | Promise<ControllerResult>)
	);

	export type Context<ControllerProps = any, ResponderProps = any, RouteDetails = any> = {
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

	export type Controller<ControllerProps = any, ControllerResult = any> =
		string |
		[string, ControllerProps] |
		ControllerFunction<ControllerProps, ControllerResult>;

	export type ResponderFunction<ControllerResult = any, ResponderProps = any> = (
		(ctx: Koa.Context, result: ControllerResult, props?: ResponderProps) => (Promise<void> | void)
	);

	export type Responder<ControllerResult = any, ResponderProps = any> = {
		name: string;
		middleware?: ((ctx: Koa.Context, next: Koa.Next) => (Promise<void> | void));
		error?: ((ctx: Koa.Context, error: Error) => (Promise<void> | void));
		depth?: number;
		responder: ResponderFunction<ControllerResult, ResponderProps>;
	}

	export type MiddlewareCtor = MiddlewareFunction | ( (credo: CredoJS) => MiddlewareFunction );

	export type ResponderCtor<C = never> = (credo: CredoJS, name: string, config?: C) => Responder;

	export type ExtraMiddlewareFunction<MProps = never> = (ctx: Koa.Context, next: Koa.Next, props?: MProps) => (Promise<void> | void);
	export type ExtraMiddlewareType<MProps = any> = string | [string, MProps] | [null, string];
	export type ExtraMiddleware<MProps = any> = {name: string, props?: MProps};
	export type ExtraMiddlewareCtor<MProps = never> = ExtraMiddlewareFunction | ( (credo: CredoJS) => ExtraMiddlewareFunction<MProps> );
}

// Cron
export namespace Cron {

	type Base = {
		name?: string;
		rule: string | RecurrenceSpecDateRange | RecurrenceSpecObjLit | Date;
		bootstrap?: boolean;
		overload?: Overload;
		overloadTimeout?: number;
	}

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
		job(date: Date): void | Promise<void>;
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
	}

	export type ReadOptions<R = string> = {
		builder?: () => (R | Promise<R>);
		json?: boolean;
	}

	export type RequireOptions<R = any> = {
		builder?: () => (string | Promise<string>);
		clearCache?: boolean;
		hash?: [keyof R, string];
	}

	export type ListOptions = {
		path?: string;
		depth?: number;
		mask?: string | RegExp | ((file: string, path: string | null) => boolean);
		hidden?: boolean;
	}
}

// hooks
export interface CtxHook { ctx: Koa.Context }

export interface OnMakeURLServerHook extends OnMakeURLHook, CtxHook { name?: string }
export interface OnAppStateHook<State = any> extends CtxHook { ctx: Koa.Context, state: State }
export interface OnResponseHook extends CtxHook {}
export interface OnResponseRouteHook extends CtxHook { notFound: boolean }
export interface OnResponseCompleteHook extends CtxHook {}
export interface OnResponseControllerHook<Result = any> extends CtxHook { result: Result; }
export interface OnResponseErrorHook extends CtxHook { route?: Route.Context, code?: string, error: Error }
export interface OnLoadHook { complete(handler: Function): void }
export interface OnBootHook { }
