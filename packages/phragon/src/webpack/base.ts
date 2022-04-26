import type { Configuration } from "webpack";
import { join as joinPath } from "path";
import type { BuildConfigure } from "../types";
import { externals } from "./config";
import { alias } from "../config";
import optimization from "./optimization";
import * as plugins from "./plugins";
import * as rules from "./rules";
import { mergeExtensions, buildPath } from "../utils";
const nodeExternals = require("webpack-node-externals");
const IgnoreConfigRequire = require("./utils/ignore-config-require");

export default async function base(config: BuildConfigure): Promise<Configuration> {
	const {
		type,
		mode,
		isDevServer,
		isServer,
		isServerPage,
		isClient,
		bundlePath,
		cwd,
		factory: { options },
		cluster,
		progressLine,
	} = config;

	if (isServer && !isServerPage) {
		throw new Error("For the server bundle, use the rollup builder");
	}

	let entryFile: string = type;
	let outputPath: string = `/${type}`;
	if (cluster) {
		entryFile = `${type === "client" ? `client-${cluster.mid}/client` : `pages/server-page-${cluster.mid}`}`;
		outputPath += `-${cluster.mid}`;
	}

	// create entry
	const entry: Record<string, string[]> = {
		[type]: [buildPath(`${entryFile}.js`)],
	};

	// output
	const output: any = {
		path: bundlePath(outputPath),
		filename: isServer ? "[name].js" : "[name].[fullhash].js",
		chunkFilename: "chunk/[name].[fullhash].js",
	};

	if (isClient && isDevServer) {
		entry.client.push(joinPath(__dirname, "./utils/clean-console-on-hmr.js"));
	}

	let extensions = [".ts", ".js"];
	if (options.renderDriver?.extensions?.all) {
		extensions = mergeExtensions(extensions, options.renderDriver.extensions.all);
	}

	let allowlist: string[] = [];
	if (isServer && options.renderDriver?.clientDependencies) {
		allowlist = options.renderDriver.clientDependencies;
	}

	const configure: Configuration = <Configuration>{
		context: cwd,
		target: isServer ? "node" : isDevServer ? "web" : ["web", "es5"],
		mode,
		entry,
		output,
		module: {
			rules: [
				await rules.javascriptRule(config),
				await rules.typescriptRule(config),
				await rules.imagesRule(config),
				await rules.fontsRule(config),
				await rules.cssRule(config),
				...(await rules.sassRules(config)),
				await rules.svgRule(config),
			],
		},
		plugins: [
			plugins.providePlugin(config),
			await plugins.definePlugin(config),
			plugins.webpackManifestPlugin(config),
			new IgnoreConfigRequire(),
		],
		resolve: {
			alias: await alias(config),
			extensions,
		},
		optimization: await optimization(config),
		externalsPresets: {
			// in order to ignore built-in modules like path, fs, etc.
			node: isServer,
		},
		externals: isServer ? [nodeExternals({ allowlist }), { "any-promise": "Promise" }] : externals(config),
	};

	if (progressLine) {
		configure.plugins?.push(plugins.webpackProgressPlugin(config));
	}

	return configure;
}
