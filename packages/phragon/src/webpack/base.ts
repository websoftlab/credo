import type { Configuration, RuleSetRule, Compiler, WebpackPluginInstance } from "webpack";
import type { BuildConfigure } from "../types";
import { join as joinPath, sep } from "node:path";
import { externals } from "./config";
import { alias } from "../config";
import optimization from "./optimization";
import * as plugins from "./plugins";
import * as rules from "./rules";
import { mergeExtensions, buildPath } from "../utils";
import { webpack as webpackStore } from "../builder/configure";
import { toAsync } from "@phragon-util/async";
import { debug } from "../debug";
const nodeExternals = require("webpack-node-externals");
const IgnoreConfigRequire = require("./utils/ignore-config-require");

function createStartsWith(item: string) {
	const dir = item.endsWith("/");
	item = joinPath(process.cwd(), item);
	if (dir) {
		item += sep;
	}
	return (module: { resource?: any }) => module.resource && module.resource.startsWith(item as string);
}

function createChunkGroupTest(list: (string | Function | RegExp)[]) {
	list = list.map((item) => {
		if (typeof item === "string") {
			if (item.startsWith("./")) {
				return createStartsWith(item);
			}
			if (sep !== "/") {
				return item.replace(/\//g, sep);
			}
		}
		return item;
	});
	return function (this: any, ...args: any[]) {
		return list.some((item) => {
			if (typeof item === "function") {
				return item.apply(this, args);
			}
			const resource = args[0]?.resource;
			if (typeof resource === "string" && resource.length > 0) {
				return item instanceof RegExp ? item.test(resource) : resource.includes(item);
			}
			return false;
		});
	};
}

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
		factory: { render },
		cluster,
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
	if (render?.extensions?.all) {
		extensions = mergeExtensions(extensions, render.extensions.all);
	}

	let allowlist: string[] = [];
	if (isServer && render?.clientDependencies) {
		allowlist = render.clientDependencies;
	}

	const ruleList: RuleSetRule[] = [
		await rules.javascriptRule(config),
		await rules.typescriptRule(config),
		await rules.replaceRule(config),
	];

	const pluginList: (((this: Compiler, compiler: Compiler) => void) | WebpackPluginInstance)[] = [
		plugins.providePlugin(config),
		await plugins.definePlugin(config),
		plugins.webpackManifestPlugin(config),
		new IgnoreConfigRequire(),
	];

	const configure: Configuration = <Configuration>{
		context: cwd,
		target: isServer ? "node" : isDevServer ? "web" : ["web", "es5"],
		mode,
		entry,
		output,
		module: {
			rules: ruleList,
		},
		plugins: pluginList,
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

	// load webpack options from builder store
	const store = webpackStore(config.factory.builder.getStore());
	if (store.rule.length) {
		ruleList.push(...store.rule);
	}

	if (store.plugin.length) {
		pluginList.push(...store.plugin);
	}

	if (store.vendor.length) {
		const splitChunks = configure.optimization?.splitChunks;
		if (splitChunks) {
			const commons = splitChunks.cacheGroups?.commons;
			if (commons && typeof commons === "object" && !(commons instanceof RegExp) && commons.name === "vendor") {
				const test = commons.test;
				commons.test = createChunkGroupTest((test ? [test] : []).concat(store.vendor));
			}
		}
	}

	if (store.config.length) {
		for (const callback of store.config) {
			await toAsync(callback(configure, config));
		}
	}

	// add progress line
	if (debug.isTTY) {
		pluginList.push(plugins.webpackProgressPlugin(config));
	}

	return configure;
}
