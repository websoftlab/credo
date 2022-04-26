import { join } from "path";
import type { BuildConfigure, BuildConfigureOptions, BuilderType, BuildMode, PhragonPlugin } from "./types";
import { debugBuild, debugError } from "./debug";

function getMode(value?: string) {
	return getIsProdMode(value === "production");
}

function getIsProdMode(isProd: boolean): BuildMode {
	return isProd ? "production" : "development";
}

export default async function configure(
	options: BuildConfigureOptions,
	builderType: BuilderType
): Promise<BuildConfigure> {
	let {
		type,
		mode: modeOption,
		isProd: isProdOption,
		isDev: isDevOption,
		isDevServer: isDevServerOption,
		cwd: cwdPathOption,
		factory,
		debug,
		...restOptions
	} = options;

	if (!["client", "server", "server-page"].includes(type)) {
		throw new Error(`Invalid type - ${type}`);
	}

	const mode =
		typeof modeOption === "string"
			? getMode(modeOption)
			: typeof isProdOption === "boolean"
			? getIsProdMode(isProdOption)
			: typeof isDevOption === "boolean"
			? getIsProdMode(!isDevOption)
			: getMode(process.env.NODE_ENV);

	const isDevServer =
		typeof isDevServerOption === "boolean" ? isDevServerOption : process.env.WEBPACK_IS_DEV_SERVER === "true";

	const isProd = mode === "production";
	const isDev = !isProd;
	const isServer = type === "server" || type === "server-page";
	const isServerPage = isServer && type === "server-page";
	const isClient = !isServer;
	const cwdPath = typeof cwdPathOption === "string" ? cwdPathOption : process.cwd();

	if (isServer && isDevServer) {
		throw new Error("Server mode not supported devServer");
	}

	const bundle = mode === "development" ? "dev" : "build";
	const {
		lexicon: { language, languages, multilingual },
	} = factory.options;

	const config: BuildConfigure = {
		...restOptions,
		factory,
		type,
		languages,
		multilingual,
		language,
		builderType,
		mode,
		bundle,
		isProd,
		isDev,
		isDevServer,
		isServer,
		isServerPage,
		isClient,
		cwd: cwdPath,
		cwdPath(...args: string[]) {
			return join(cwdPath, ...args);
		},
		bundlePath(...args: string[]) {
			return join(cwdPath, bundle, ...args);
		},
		debug(message: string, error?: boolean) {
			if (debug) {
				debug(message, error);
			} else if (error) {
				debugError(message);
			} else {
				debugBuild(message);
			}
		},
		async fireHook(name: PhragonPlugin.HooksBundleEvent, arg1?: any) {
			switch (name) {
				case "onRollupConfigure":
					return factory.fireHook(name, arg1, config);
				case "onWebpackConfigure":
					return factory.fireHook(name, arg1, config);
			}
		},
		async fireOnOptionsHook<T>(name: string, option: T): Promise<T> {
			await factory.fireHook("onOptions", { name, option }, config);
			return option;
		},
	};

	return config;
}
