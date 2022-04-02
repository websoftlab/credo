import type {InputOptions, OutputOptions} from "rollup";
import type {Configuration} from "webpack";

export type BuildMode = "production" | "development";

export type BuildType = "client" | "server" | "server-page";

export type BuilderType = "webpack" | "rollup";

export type EStat = {
	file: string,
	isFile: boolean,
	isDirectory: boolean,
	isSymbolicLink: boolean,
	size: number,
}

interface Configure {
	mode: BuildMode;
	isProd: boolean;
	isDev: boolean;
	isDevServer: boolean;
	cwd: string;
}

export type DaemonSignKill =
	| "SIGABRT" | "SIGALRM" | "SIGBUS"  | "SIGCHLD" | "SIGCONT" | "SIGFPE"  | "SIGHUP"  | "SIGILL"    | "SIGINT"
	| "SIGKILL" | "SIGPIPE" | "SIGPOLL" | "SIGPROF" | "SIGQUIT" | "SIGSEGV" | "SIGSTOP" | "SIGSYS"    | "SIGTERM"
	| "SIGTRAP" | "SIGTSTP" | "SIGTTIN" | "SIGTTOU" | "SIGUSR1" | "SIGUSR2" | "SIGURG"  | "SIGVTALRM" | "SIGXCPU"
	| "SIGXFSZ" | "SIGWINCH";

export type WebpackConfigure = Configuration & {devServer?: Record<string, any>};

export type RollupConfigure = InputOptions & {output: OutputOptions};

export interface BuildOptions {
	mode: BuildMode;
	factory: CredoPlugin.Factory;
	cluster?: CredoPlugin.RootClusterOptions;
	progressLine: boolean;
}

export interface BuildConfigureOptions extends Partial<Configure>, Omit<BuildOptions, "mode"> {
	type: BuildType;
	debug?(text: string, error?: boolean): void;
}

export interface BuildConfigure extends Configure, Omit<BuildOptions, "mode"> {
	type: BuildType;
	isServer: boolean;
	isServerPage: boolean;
	isClient: boolean;
	bundle: string;
	builderType: BuilderType;
	multilingual: boolean;
	language: string | undefined;
	languages: string[];
	cwdPath(...args: string[]): string;
	bundlePath(...args: string[]): string;
	debug(message: string, error?: boolean): void;

	fireHook(name: "onWebpackConfigure", config: WebpackConfigure): Promise<void>;
	fireHook(name: "onRollupConfigure", config: RollupConfigure): Promise<void>;
	fireOnOptionsHook<T>(name: string, option: T): Promise<T>;

	// optional
	devServerHost?: string;
	devServerPort?: string | number;
	devPort?: string | number;
	devSSR?: boolean;
}

export interface ErrorContext extends Error { context?: string[] }

export declare namespace Watch {

	type Listener<T> = (argument: T) => (void | Promise<void>);
	type Lambda = () => void;
	type BeforeAfterEvent = BuildOptions & {force: boolean, initial: boolean};

	export type EventName = "onBeforeStart" | "onAfterStart" | "onError" | "onChangeOptions" | "onInit" | "onAbort";

	export interface Trigger {
		promise: Promise<void>;
		update(error?: Error): void;
		close(): void;
	}

	export interface Serve extends BuildOptions {
		readonly started: boolean;
		readonly initialized: boolean;
		readonly ssr: boolean;

		on(name: "onBeforeStart", listener: Listener<BeforeAfterEvent>): Lambda;
		on(name: "onAfterStart", listener: Listener<BeforeAfterEvent>): Lambda;
		on(name: "onError", listener: Listener<ErrorContext>): Lambda;
		on(name: "onChangeOptions", listener: Listener<BuildOptions>): Lambda;
		on(name: "onInit", listener: Listener<never>): Lambda;
		on(name: "onAbort", listener: Listener<Error | undefined>): Lambda;
		on(name: "onDebug", listener: Listener<{text: string, context: BuildType | "system", error: boolean}>): Lambda;

		off(name: EventName, listener: Function): void;

		emitDebug(text: string, context: BuildType | "system", error?: boolean): void;
		emitError<T extends ErrorContext = ErrorContext>(error: T, context?: string): T;

		start(): Promise<void>;
		restart(options?: BuildOptions): Promise<void>;
		abort(err?: Error): Promise<void>;
		createTrigger(): Trigger;
	}

	interface CMDOptions {
		devHost?: string,
		devPort?: number,
		host?: string,
		port?: number,
		ssr?: boolean,
		cluster?: string,
	}
}

export declare namespace CredoConfig {

	export type Handler = string | {
		path: string;
		importer?: string; // default = "default"
		options?: any; // undefined
	}

	export interface FileJSON {
		dependencies?: string[];
		bootloader?: Handler;
		bootstrap?: Handler;
		middleware?: Handler[];
		extraMiddleware?: Record<string, Handler>;
		responders?: Record<string, Handler>;
		cmd?: Record<string, Handler>;
		public?:  string | true; // true eq "./public"
		lexicon?: string | true; // true eq "./lexicon"
		config?:  string | true; // true eq "./config"
		services?: Record<string, Handler>;
		controllers?: Record<string, Handler>;
		hooks?: Record<string, Handler>;
	}

	export interface RootCluster {
		id: string;
		mode?: "app" | "cron";
		count?: number;
		ssr?: boolean;
		public?: string;
		bootstrap?: Handler;
		bootloader?: Handler;
		env?: Record<string, string>;
	}

	type RootLexiconExcludeInclude = string | { name: string, type?: "lambda" | "data" | "all" };

	export interface RootLexicon {
		language: string;
		languages?: string[];
		multilingual?: boolean;
		exclude?: RootLexiconExcludeInclude[];
		include?: RootLexiconExcludeInclude[];
		route?: {
			method?: string;
			path: string;
			service: string;
		};
		packages?: string[];
	}

	export interface Root {
		clusters?: RootCluster[];
		ssr?: boolean;
		lexicon?: RootLexicon;
		configLoaders?: Record<string, Handler>;
		renderDriver?: string | false;
	}

	export interface FileJSONRoot extends FileJSON {
		options?: Root;
	}
}

export declare namespace CredoPlugin {

	export interface Handler {
		path: string;
		importer: string;
	}

	export interface HandlerOptional extends Handler {
		options?: any;
	}

	export interface RenderDriver {
		name: string;
		modulePath: string;
		loadable?: string;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		clientDependencies?: string[];
		extensions?: {
			all?: string[],
			typescript?: string[],
			javascript?: string[],
		};
		hooks?: Hooks;
	}

	export interface Factory {
		readonly root: Plugin;
		readonly options: RootOptions;
		readonly plugins: Plugin[];

		plugin(name: string): Plugin | null;
		installed(name: string): boolean;
		exists(name: string): boolean;

		on(name: "onBuild", listener: (options: Factory) => (void | Promise<void>)): void;
		on(name: "onInstall", listener: (options: { name: string, factory: Factory, department: Department }) => (void | Promise<void>)): void;
		on(name: "onWebpackConfigure", listener: (config: WebpackConfigure, options: BuildConfigure) => (void | Promise<void>)): void;
		on(name: "onRollupConfigure", listener: (config: RollupConfigure, options: BuildConfigure) => (void | Promise<void>)): void;
		on<T = any>(name: "onOptions", listener: (event: { name: string, option: T }, options: BuildConfigure) => (void | Promise<void>)): void;

		off(name: "onBuild", listener?: Function): void;
		off(name: "onInstall", listener?: Function): void;
		off(name: "onWebpackConfigure", listener?: Function): void;
		off(name: "onRollupConfigure", listener?: Function): void;
		off(name: "onOptions", listener?: Function): void;

		fireHook(name: "onBuild", options: Factory): Promise<void>;
		fireHook(name: "onInstall", options: { name: string, factory: Factory, department: Department }): Promise<void>;
		fireHook(name: "onWebpackConfigure", config: WebpackConfigure, options: BuildConfigure): Promise<void>;
		fireHook(name: "onRollupConfigure", config: RollupConfigure, options: BuildConfigure): Promise<void>;
		fireHook<T = any>(name: "onOptions", event: { name: string, option: T }, options: BuildConfigure): Promise<void>;
	}

	export interface Department {
		readonly name: string;
		readonly plugin: Plugin;

		get<T = any>(key: string, defaultValue?: T): T;
		set<T = any>(key: string, value: T): void;
		del(key: string): void;
	}

	export interface Hooks {
		onBuild?(options: Factory): void | Promise<void>;
		onInstall?(options: { name: string, factory: Factory, department: Department }): void | Promise<void>;
		onWebpackConfigure?(config: WebpackConfigure, options: BuildConfigure): void | Promise<void>;
		onRollupConfigure?(config: RollupConfigure, options: BuildConfigure): void | Promise<void>;
		onOptions?<T = any>(event: { name: string, option: T }, options: BuildConfigure): void | Promise<void>;
	}

	export type HooksEvent = keyof Hooks;
	export type HooksBundleEvent = "onWebpackConfigure" | "onRollupConfigure";

	interface BaseOptions {
		pages: string | false;
		components?: Record<string, string>;
	}

	export interface RootClusterOptions extends BaseOptions {
		id: string;
		mid: number;
		mode: "app" | "cron";
		count: number;
		ssr: boolean;
		publicPath?: string;
		bootstrap?: HandlerOptional;
		bootloader?: HandlerOptional;
		env?: Record<string, string>;
	}

	export interface RootLexiconOptions {
		language?: string;
		languages: string[];
		multilingual: boolean;
		exclude?: Array<{ name: string, type: "lambda" | "data" | "all" }>;
		include?: Array<{ name: string, type: "lambda" | "data" | "all" }>;
		route?: {
			method: string;
			path: string;
			service: string;
		};
		packages?: string[];
	}

	export interface RootDaemonOptions {
		delay?: number;
		cpuPoint?: number;
		killSignal?: DaemonSignKill;
		pid?: string;
	}

	export interface RootOptions extends BaseOptions {
		clusters?: RootClusterOptions[];
		ssr: boolean;
		lexicon: RootLexiconOptions;
		configLoaders?: Record<string, Handler>;
		renderDriver?: RenderDriver;
		onBuildTimeout?: string | number;
		daemon?: RootDaemonOptions;
	}

	export interface Plugin {
		name: string;
		root: boolean;
		version: string;
		pluginPath: string;
		credoJsonPath: string;

		hooks: Partial<Record<HooksEvent, Handler>>;
		dependencies: string[];
		services: Record<string, HandlerOptional>;
		controllers: Record<string, HandlerOptional>;
		middleware: HandlerOptional[];
		responders: Record<string, HandlerOptional>;
		extraMiddleware: Record<string, HandlerOptional>;
		cmd: Record<string, HandlerOptional>;
		bootloader?: HandlerOptional;
		bootstrap?: HandlerOptional;
		public?: string;
		lexicon?: string;
		config?: string;

		joinPath(... args: string[]): string;
		resolver(file: string | string[], mode?: "mixed" | "file" | "directory"): Promise<null | EStat>
	}
}