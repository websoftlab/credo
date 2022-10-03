import type { BuildConfigure } from "../types";
import { define as defineStoreBuilder } from "../builder/configure";

function toDef(value: any) {
	if (value === null) return "null";
	if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
	switch (typeof value) {
		case "undefined":
			return "undefined";
		case "number":
			return String(value);
		case "boolean":
			return value ? "true" : "false";
		case "string":
		case "object":
			return JSON.stringify(value);
		case "bigint":
			return `BigInt(${JSON.stringify(value.toString())})`;
		case "symbol":
			return value.description ? `Symbol.for(${JSON.stringify(value.description)})` : "Symbol()";
		case "function":
			return "function() { throw new Error('function type not supported'); }";
	}
	return "null";
}

export default async function define(config: BuildConfigure) {
	const { mode, bundle, isServer, isClient, isProd, isDev, isDevServer, factory } = config;
	const def: Record<string, boolean | number | string | object> = await config.fireOnOptionsHook("config.define", {
		...defineStoreBuilder(factory.builder.getStore()),
		"process.env.NODE_ENV": mode,
		__ENV__: mode,
		__SRV__: isServer,
		__WEB__: isClient,
		__SSR__: isServer ? factory.ssr : false,
		__DEV__: isDev,
		__DEV_SERVER__: isDevServer,
		__PROD__: isProd,
		__BUNDLE__: bundle,
		"__isSrv__()": isServer,
		"__isWeb__()": isClient,
		"__isDev__()": isDev,
		"__isProd__()": isProd,
		"__env__()": mode,
	});

	Object.keys(def).forEach((key) => {
		def[key] = toDef(def[key]);
	});

	return def as Record<string, string>;
}
