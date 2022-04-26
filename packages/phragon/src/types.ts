import type { InputOptions, OutputOptions } from "rollup";
import type { Configuration } from "webpack";
import { RollupWatcher } from "rollup";
import { ChildProcessByStdio } from "child_process";

export type BuildMode = "production" | "development";

export type BuildType = "client" | "server" | "server-page";

export type BuilderType = "webpack" | "rollup";

export type EStat = {
	file: string;
	isFile: boolean;
	isDirectory: boolean;
	isSymbolicLink: boolean;
	size: number;
};

interface Configure {
	mode: BuildMode;
	isProd: boolean;
	isDev: boolean;
	isDevServer: boolean;
	cwd: string;

	// optional
	devServerHost?: string;
	devServerPort?: string | number;
	devPort?: string | number;
}

// prettier-ignore
export type DaemonSignKill =
	| "SIGABRT" | "SIGALRM" | "SIGBUS"  | "SIGCHLD" | "SIGCONT" | "SIGFPE"  | "SIGHUP"  | "SIGILL"    | "SIGINT"
	| "SIGKILL" | "SIGPIPE" | "SIGPOLL" | "SIGPROF" | "SIGQUIT" | "SIGSEGV" | "SIGSTOP" | "SIGSYS"    | "SIGTERM"
	| "SIGTRAP" | "SIGTSTP" | "SIGTTIN" | "SIGTTOU" | "SIGUSR1" | "SIGUSR2" | "SIGURG"  | "SIGVTALRM" | "SIGXCPU"
	| "SIGXFSZ" | "SIGWINCH";

export type WebpackConfigure = Configuration & { devServer?: Record<string, any> };

export type RollupConfigure = InputOptions & { output: OutputOptions };

export interface BuildOptions {
	mode: BuildMode;
	factory: PhragonPlugin.Factory;
	cluster?: PhragonPlugin.RootClusterOptions;
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
}

export interface ErrorContext extends Error {
	context?: string[];
}

export declare namespace Watch {
	export type EventName = "onBeforeStart" | "onAfterStart" | "onError" | "onChangeOptions" | "onInit" | "onAbort";

	export interface Trigger {
		promise: Promise<void>;
		update(error?: Error): void;
		close(): void;
	}

	interface CMDOptions {
		devHost?: string;
		devPort?: number;
		host?: string;
		port?: number;
		ssr?: boolean;
		cluster?: string;
		noBoard?: boolean;
	}

	export interface DebugEvent {
		message: string;
		error?: boolean;
		context?: string;
	}

	export interface Serve {
		watcher: RollupWatcher | null;
		child: ChildProcessByStdio<any, any, any> | null;
		factory: PhragonPlugin.Factory | null;

		readonly progress: boolean;
		readonly port: number;
		readonly devPort: number;
		readonly host: string;
		readonly devHost: string;
		readonly ssr: boolean;
		readonly clusterId: string | null;
		readonly cluster?: PhragonPlugin.RootClusterOptions | undefined;
		readonly started: boolean;

		start(): Promise<boolean>;
		restart(): Promise<boolean>;
		stop(): Promise<boolean>;

		on(name: "error", listener: (error: Error) => void): this;
		on(name: "debug", listener: (event: DebugEvent) => void): this;
		on(name: "stop", listener: () => void): this;
		on(name: "onBeforeBuild", listener: () => void): this;
		on(name: "build", listener: () => void): this;
		on(name: "onBeforeStart", listener: () => void): this;
		on(name: "start", listener: () => void): this;

		once(name: "error", listener: (error: Error) => void): this;
		once(name: "debug", listener: (event: DebugEvent) => void): this;
		once(name: "stop", listener: () => void): this;
		once(name: "onBeforeBuild", listener: () => void): this;
		once(name: "build", listener: () => void): this;
		once(name: "onBeforeStart", listener: () => void): this;
		once(name: "start", listener: () => void): this;

		addListener(name: "error", listener: (error: Error) => void): this;
		addListener(name: "debug", listener: (event: DebugEvent) => void): this;
		addListener(name: "stop", listener: () => void): this;
		addListener(name: "onBeforeBuild", listener: () => void): this;
		addListener(name: "build", listener: () => void): this;
		addListener(name: "onBeforeStart", listener: () => void): this;
		addListener(name: "start", listener: () => void): this;

		off(name: "error", listener: (error: Error) => void): this;
		off(name: "debug", listener: (event: DebugEvent) => void): this;
		off(name: "stop", listener: () => void): this;
		off(name: "onBeforeBuild", listener: () => void): this;
		off(name: "build", listener: () => void): this;
		off(name: "onBeforeStart", listener: () => void): this;
		off(name: "start", listener: () => void): this;

		removeListener(name: "error", listener: (error: Error) => void): this;
		removeListener(name: "debug", listener: (event: DebugEvent) => void): this;
		removeListener(name: "stop", listener: () => void): this;
		removeListener(name: "onBeforeBuild", listener: () => void): this;
		removeListener(name: "build", listener: () => void): this;
		removeListener(name: "onBeforeStart", listener: () => void): this;
		removeListener(name: "start", listener: () => void): this;

		emit(name: "error", error: Error): boolean;
		emit(name: "debug", event: string | Error | DebugEvent): boolean;
		emit(name: "stop"): boolean;
		emit(name: "onBeforeBuild"): boolean;
		emit(name: "build"): boolean;
		emit(name: "onBeforeStart"): boolean;
		emit(name: "start"): boolean;

		removeAllListeners(name: "error"): this;
		removeAllListeners(name: "debug"): this;
		removeAllListeners(name: "stop"): this;
		removeAllListeners(name: "onBeforeBuild"): this;
		removeAllListeners(name: "build"): this;
		removeAllListeners(name: "onBeforeStart"): this;
		removeAllListeners(name: "start"): this;
	}
}

export declare namespace PhragonConfig {
	export type Handler =
		| string
		| {
				path: string;
				importer?: string; // default = "default"
				options?: any; // undefined
		  };

	export interface FileJSON {
		dependencies?: string[];
		bootloader?: Handler;
		bootstrap?: Handler;
		middleware?: Handler[];
		extraMiddleware?: Record<string, Handler>;
		responders?: Record<string, Handler>;
		cmd?: Record<string, Handler>;
		public?: string | true; // true eq "./public"
		lexicon?: string | true; // true eq "./lexicon"
		config?: string | true; // true eq "./config"
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

	type RootLexiconExcludeInclude = string | { name: string; type?: "lambda" | "data" | "all" };

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

export declare namespace PhragonPlugin {
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
			all?: string[];
			typescript?: string[];
			javascript?: string[];
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

		on(name: "onBuild", listener: (options: Factory) => void | Promise<void>): void;
		on(
			name: "onInstall",
			listener: (options: { name: string; factory: Factory; department: Department }) => void | Promise<void>
		): void;
		on(
			name: "onWebpackConfigure",
			listener: (config: WebpackConfigure, options: BuildConfigure) => void | Promise<void>
		): void;
		on(
			name: "onRollupConfigure",
			listener: (config: RollupConfigure, options: BuildConfigure) => void | Promise<void>
		): void;
		on<T = any>(
			name: "onOptions",
			listener: (event: { name: string; option: T }, options: BuildConfigure) => void | Promise<void>
		): void;

		off(name: "onBuild", listener?: Function): void;
		off(name: "onInstall", listener?: Function): void;
		off(name: "onWebpackConfigure", listener?: Function): void;
		off(name: "onRollupConfigure", listener?: Function): void;
		off(name: "onOptions", listener?: Function): void;

		fireHook(name: "onBuild", options: Factory): Promise<void>;
		fireHook(name: "onInstall", options: { name: string; factory: Factory; department: Department }): Promise<void>;
		fireHook(name: "onWebpackConfigure", config: WebpackConfigure, options: BuildConfigure): Promise<void>;
		fireHook(name: "onRollupConfigure", config: RollupConfigure, options: BuildConfigure): Promise<void>;
		fireHook<T = any>(
			name: "onOptions",
			event: { name: string; option: T },
			options: BuildConfigure
		): Promise<void>;
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
		onInstall?(options: { name: string; factory: Factory; department: Department }): void | Promise<void>;
		onWebpackConfigure?(config: WebpackConfigure, options: BuildConfigure): void | Promise<void>;
		onRollupConfigure?(config: RollupConfigure, options: BuildConfigure): void | Promise<void>;
		onOptions?<T = any>(event: { name: string; option: T }, options: BuildConfigure): void | Promise<void>;
	}

	export type HooksEvent = keyof Hooks;
	export type HooksBundleEvent = "onWebpackConfigure" | "onRollupConfigure";

	interface BaseOptions {
		pages: string | false;
		components?: Record<string, string>;
		renderOptions?: any;
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
		exclude?: Array<{ name: string; type: "lambda" | "data" | "all" }>;
		include?: Array<{ name: string; type: "lambda" | "data" | "all" }>;
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
		phragonJsonPath: string;

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

		joinPath(...args: string[]): string;
		resolver(file: string | string[], mode?: "mixed" | "file" | "directory"): Promise<null | EStat>;
	}
}
