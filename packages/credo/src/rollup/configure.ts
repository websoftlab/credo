import typescript from "@rollup/plugin-typescript";
import externals from "rollup-plugin-node-externals";
import resolvePlugin from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import aliasPlugin from "@rollup/plugin-alias";
import baseConfigure from "../configure";
import {alias, define} from "../config";
import {isPlainObject} from "@credo-js/utils";
import {cwdPath, buildPath, exists} from "../utils";
import progressRollupPlugin from "./plugins/progressRollupPlugin";
import type {InputOptions, OutputOptions} from "rollup";
import type {Alias} from "@rollup/plugin-alias";
import type {BuildConfigureOptions, BuildConfigure} from "../types";

function mergeAliases(left: Alias[], right: any): Alias[] {
	const merge = (find: string, replacement: string) => {
		left.push({
			find,
			replacement,
		});
	};
	if(Array.isArray(right)) {
		right.forEach(item => {
			if(isPlainObject(item) && item.find && item.replacement) {
				left.push(item);
			}
		});
	} else if(isPlainObject(right)) {
		Object.keys(right).forEach(key => {
			const value = right[key];
			if(typeof value === "string") {
				merge(key, value);
			} else if(Array.isArray(value)) {
				value.forEach(val => {
					typeof val === "string" && merge(key, val);
				});
			}
		});
	}
	return left;
}

export default async function configure(options: BuildConfigureOptions): Promise<InputOptions & {output: OutputOptions}> {
	const conf: BuildConfigure = await baseConfigure(options, "rollup");
	const {
		isClient,
		isDevServer,
		isServerPage,
		bundle,
		progressLine,
		cluster,
		factory: {options: {clusters}}
	} = conf;

	if(isClient || isServerPage || isDevServer) {
		throw new Error("Attention, the rollup package manager should only work in server mode!")
	}

	let aliases = mergeAliases([], await alias(conf));
	let extensions = ['.ts', '.js'];

	const input: Record<string, string> = {};
	function add(key: string) {
		input[key] = buildPath(`${key}.js`);
	}

	add("server");
	if(cluster) {
		add(`srv/server-${cluster.mid}`);
	} else if(clusters) {
		for(const cluster of clusters) {
			add(`srv/server-${cluster.mid}`);
		}
	}

	let tsconfig: string | false = cwdPath("tsconfig-server.json");
	if(!await exists(tsconfig)) {
		tsconfig = cwdPath("tsconfig.json");
		if(!await exists(tsconfig)) {
			tsconfig = false;
		}
	}

	const config: InputOptions & {output: OutputOptions} = {
		input,
		output: {
			dir: cwdPath(`${bundle}/server`),
			format: 'cjs',
			inlineDynamicImports: false
		},
		plugins: [
			replace({
				preventAssignment: false,
				values: await define(conf),
			}),
			externals(await conf.fireOnOptionsHook("plugin.externals", {
				deps: true,
				include: [
					/^@credo-js\/\w+/
				],
			})),
			commonjs(await conf.fireOnOptionsHook("plugin.commonjs", {
				extensions,
			})),
			json(await conf.fireOnOptionsHook("plugin.json", {
				namedExports: false,
			})),
			aliasPlugin({
				entries: aliases,
			}),
			resolvePlugin(await conf.fireOnOptionsHook("plugin.resolve", {
				extensions,
			})),
			typescript(await conf.fireOnOptionsHook("plugin.typescript", {
				tsconfig,
				cacheDir: buildPath("ts-cache"),
				allowJs: true,
			})),
		],
	};

	if(progressLine) {
		config.plugins?.push(progressRollupPlugin(conf));
	}

	await conf.fireHook("onRollupConfigure", config);

	return config;
}