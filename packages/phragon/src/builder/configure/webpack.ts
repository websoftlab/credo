import type BuilderStore from "../BuilderStore";
import type { RuleSetRule, Compiler, WebpackPluginInstance } from "webpack";
import type { PhragonPlugin, WebpackConfigure, BuildConfigure } from "../../types";
import { isPlainObject } from "@phragon-util/plain-object";
import { isList } from "./util";

type WebpackVendorType = string | RegExp | Function;
type WebpackConfigCallback = (webpack: WebpackConfigure, config: BuildConfigure) => void | Promise<void>;
type WebpackPlugin = ((this: Compiler, compiler: Compiler) => void) | WebpackPluginInstance;

export function webpackVendor(store: BuilderStore) {
	const vendor: PhragonPlugin.ConfigType<"vendor", WebpackVendorType>[] | undefined = store.store.webpack.vendor;
	if (!isList(vendor)) {
		return [];
	}
	const vendorList: WebpackVendorType[] = [];
	function valid(vendor: WebpackVendorType) {
		return (
			!vendorList.includes(vendor) &&
			(typeof vendor === "string" ? vendor.length > 0 : typeof vendor === "function" || vendor instanceof RegExp)
		);
	}
	vendor.forEach(({ vendor }) => {
		if (valid(vendor)) {
			vendorList.push(vendor);
		}
	});
	return vendorList;
}

export function webpackConfig(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"callback", WebpackConfigCallback>[] | undefined = store.store.webpack.config;
	if (!isList(list)) {
		return [];
	}
	const configList: WebpackConfigCallback[] = [];
	function valid(value: WebpackConfigCallback) {
		return !configList.includes(value) && typeof value === "function";
	}
	list.forEach(({ callback }) => {
		if (valid(callback)) {
			configList.push(callback);
		}
	});
	return configList;
}

export function webpackPlugin(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"plugin", WebpackPlugin>[] | undefined = store.store.webpack.plugin;
	if (!isList(list)) {
		return [];
	}
	const pluginList: WebpackPlugin[] = [];
	function valid(value: WebpackPlugin) {
		return (
			!pluginList.includes(value) &&
			(typeof value === "function" || (isPlainObject(value) && typeof value.apply === "function"))
		);
	}
	list.forEach(({ plugin }) => {
		if (valid(plugin)) {
			pluginList.push(plugin);
		}
	});
	return pluginList;
}

export function webpackRule(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"rule", RuleSetRule>[] | undefined = store.store.webpack.rule;
	if (!isList(list)) {
		return [];
	}
	const ruleList: RuleSetRule[] = [];
	function valid(rule: RuleSetRule) {
		return isPlainObject(rule) && Object.keys(rule).length > 0 && !ruleList.includes(rule);
	}
	list.forEach(({ rule }) => {
		if (valid(rule)) {
			ruleList.push(rule);
		}
	});
	return ruleList;
}

export function webpack(store: BuilderStore) {
	return {
		vendor: webpackVendor(store),
		config: webpackConfig(store),
		plugin: webpackPlugin(store),
		rule: webpackRule(store),
	};
}
