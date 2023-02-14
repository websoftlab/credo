import type { InputOptions, OutputOptions } from "rollup";
import type { Configuration } from "webpack";
import type { RollupWatcher } from "rollup";
import type { ChildProcessByStdio } from "child_process";
import type Builder from "./builder/Builder";

export interface InstallPhragonJSOptions {
	render?: string;
}

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
	proxyHost?: string;
	proxyPort?: string | number;
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
	cluster?: PhragonPlugin.ClusterOptions;
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
	}

	export interface Serve {
		watcher: RollupWatcher | null;
		child: ChildProcessByStdio<any, any, any> | null;
		factory: PhragonPlugin.Factory | null;

		readonly port: number;
		readonly devPort: number;
		readonly host: string;
		readonly devHost: string;
		readonly ssr: boolean;
		readonly clusterId: string | null;
		readonly cluster?: PhragonPlugin.ClusterOptions | undefined;
		readonly started: boolean;

		start(): Promise<boolean>;
		restart(): Promise<boolean>;
		stop(): Promise<boolean>;

		on(name: "error", listener: (error: Error) => void): this;
		on(name: "stop", listener: () => void): this;
		on(name: "onBeforeBuild", listener: () => void): this;
		on(name: "build", listener: () => void): this;
		on(name: "onBeforeStart", listener: () => void): this;
		on(name: "start", listener: () => void): this;

		once(name: "error", listener: (error: Error) => void): this;
		once(name: "stop", listener: () => void): this;
		once(name: "onBeforeBuild", listener: () => void): this;
		once(name: "build", listener: () => void): this;
		once(name: "onBeforeStart", listener: () => void): this;
		once(name: "start", listener: () => void): this;

		addListener(name: "error", listener: (error: Error) => void): this;
		addListener(name: "stop", listener: () => void): this;
		addListener(name: "onBeforeBuild", listener: () => void): this;
		addListener(name: "build", listener: () => void): this;
		addListener(name: "onBeforeStart", listener: () => void): this;
		addListener(name: "start", listener: () => void): this;

		off(name: "error", listener: (error: Error) => void): this;
		off(name: "stop", listener: () => void): this;
		off(name: "onBeforeBuild", listener: () => void): this;
		off(name: "build", listener: () => void): this;
		off(name: "onBeforeStart", listener: () => void): this;
		off(name: "start", listener: () => void): this;

		removeListener(name: "error", listener: (error: Error) => void): this;
		removeListener(name: "stop", listener: () => void): this;
		removeListener(name: "onBeforeBuild", listener: () => void): this;
		removeListener(name: "build", listener: () => void): this;
		removeListener(name: "onBeforeStart", listener: () => void): this;
		removeListener(name: "start", listener: () => void): this;

		emit(name: "error", error: Error): boolean;
		emit(name: "stop"): boolean;
		emit(name: "onBeforeBuild"): boolean;
		emit(name: "build"): boolean;
		emit(name: "onBeforeStart"): boolean;
		emit(name: "start"): boolean;

		removeAllListeners(name: "error"): this;
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

	export interface Cluster {
		id: string;
		mode?: "app" | "cron";
		count?: number;
		ssr?: boolean;
		publicPath?: string;
		render?: boolean;
		renderOptions?: any;
		env?: Record<string, string>;
	}

	type LexiconExcludeInclude = string | { name: string; type?: "lambda" | "data" | "all" };

	export interface Lexicon {
		language?: string;
		languages?: string[];
		multilingual?: boolean;
		exclude?: LexiconExcludeInclude[];
		include?: LexiconExcludeInclude[];
		route?: {
			method?: string;
			path: string;
			service: string;
		};
		packages?: string[];
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

	export interface RenderPage {
		path: string;
		ssr: boolean;
	}

	export interface Factory {
		readonly builder: Builder;
		readonly root: Plugin;
		readonly renderPlugin: Plugin | null;
		readonly plugins: Plugin[];
		readonly lexicon: LexiconOptions;
		readonly cluster: ClusterOptions[];
		readonly render: RenderDriver | null;
		readonly renderOptions: any;
		readonly page: ConfigType<"render", RenderPage> | null;
		readonly components: ConfigType<"components", Record<string, Handler>>;
		readonly cmd: ConfigType<"cmd", HandlerOptional, { name: string }>[];
		readonly configLoader: ConfigType<"loader", HandlerOptional, { type: string }>[];
		readonly extraMiddleware: ConfigType<"middleware", HandlerOptional, { name: string }>[];
		readonly middleware: ConfigType<"middleware", HandlerOptional>[];
		readonly responder: ConfigType<"responder", HandlerOptional, { name: string }>[];
		readonly controller: ConfigType<"controller", HandlerOptional, { name: string }>[];
		readonly service: ConfigType<"service", HandlerOptional, { name: string }>[];
		readonly publicPath: ConfigType<"path", string, { relativePath: string }>[];
		readonly daemon: DaemonOptions | null;
		readonly ssr: boolean;
		readonly bootstrap: ConfigType<"bootstrap", Handler>[];
		readonly bootloader: ConfigType<"bootloader", Handler>[];

		buildTimeout: string | null;

		plugin(name: string): Plugin | null;
		installed(name: string): boolean;
		exists(name: string): boolean;

		on(name: "onBuild", listener: (options: Factory) => void | Promise<void>): void;
		on(name: "onInstall", listener: (options: Factory) => void | Promise<void>): void;
		on(
			name: "onWebpackConfigure",
			listener: (event: { rollup: RollupConfigure; config: BuildConfigure }) => void | Promise<void>
		): void;
		on(
			name: "onRollupConfigure",
			listener: (event: { rollup: RollupConfigure; config: BuildConfigure }) => void | Promise<void>
		): void;
		on<T = any>(
			name: "onOptions",
			listener: (event: { name: string; option: T; config: BuildConfigure }) => void | Promise<void>
		): void;

		off(name: "onBuild", listener: Function): void;
		off(name: "onInstall", listener: Function): void;
		off(name: "onWebpackConfigure", listener: Function): void;
		off(name: "onRollupConfigure", listener: Function): void;
		off(name: "onOptions", listener: Function): void;

		fireHook(name: "onBuild", options: Factory): Promise<void>;
		fireHook(name: "onInstall", options: Factory): Promise<void>;
		fireHook(
			name: "onWebpackConfigure",
			event: { webpack: WebpackConfigure; config: BuildConfigure }
		): Promise<void>;
		fireHook(name: "onRollupConfigure", event: { rollup: RollupConfigure; config: BuildConfigure }): Promise<void>;
		fireHook<T = any>(name: "onOptions", event: { name: string; option: T; config: BuildConfigure }): Promise<void>;
	}

	export interface Hooks {
		onBuild?(options: Factory): void | Promise<void>;
		onInstall?(options: Factory): void | Promise<void>;
		onWebpackConfigure?(config: WebpackConfigure, options: BuildConfigure): void | Promise<void>;
		onRollupConfigure?(config: RollupConfigure, options: BuildConfigure): void | Promise<void>;
		onOptions?<T = any>(event: { name: string; option: T; config: BuildConfigure }): void | Promise<void>;
	}

	export type HooksEvent = keyof Hooks;
	export type HooksBundleEvent = "onWebpackConfigure" | "onRollupConfigure";

	export interface ClusterOptions {
		page?: RenderPage;
		components?: Record<string, Handler>;
		renderOptions?: any;
		id: string;
		mid: number;
		mode: "app" | "cron";
		count: number;
		render: boolean;
		ssr: boolean;
		publicPath?: string;
		bootstrap?: Handler;
		bootloader?: Handler;
		env?: Record<string, string>;
	}

	export interface LexiconOptions {
		language: string;
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

	export interface DaemonOptions {
		delay?: number;
		cpuPoint?: number;
		killSignal?: DaemonSignKill;
		pid?: string;
	}

	export type ConfigType<Key extends string, Type, Rest = {}> = { [P in Key]: Type } & Rest & {
			__plugin: Plugin;
		};

	export interface Plugin {
		readonly cwd: string;
		readonly name: string;
		readonly version: string;
		readonly root: boolean;

		joinPath(...args: string[]): string;
	}
}
