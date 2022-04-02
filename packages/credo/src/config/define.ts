import type {BuildConfigure} from "../types";

function toDef(value: any) {
	if(value === null) return "null";
	if(value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
	switch(typeof value) {
		case "undefined": return "undefined";
		case "number": return String(value);
		case "boolean": return value ? "true" : "false";
		case "string": case "object": return JSON.stringify(value);
		case "bigint": return `BigInt(${JSON.stringify(value.toString())})`;
		case "symbol": return "Symbol()";
		case "function": return "function() { throw new Error('function type not supported'); }";
	}
	return "null";
}

export default async function define(config: BuildConfigure) {
	const {mode, bundle, isServer, isClient, isProd, isDev, isDevServer} = config;
	const def: Record<string, (boolean | number | string | object)> = await config.fireOnOptionsHook("config.define", {
		"process.env.NODE_ENV": mode,
		"__ENV__": mode,
		"__SRV__": isServer,
		"__WEB__": isClient,
		"__SSR__": isServer ? config.factory.options.ssr : false,
		"__DEV__": isDev,
		"__DEV_SERVER__": isDevServer,
		"__PROD__": isProd,
		"__BUNDLE__": bundle,
	});

	Object.keys(def).forEach(key => { def[key] = toDef(def[key]); });

	return def as Record<string, string>;
}