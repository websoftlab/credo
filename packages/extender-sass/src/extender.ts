import type { BuildExtenderResult, WebpackConfigure, BuildConfigure } from "phragon";
import type { ExtenderSassOptions } from "./types";
import { isCssRule } from "@phragon/extender-css";
import { isScssRule, sassRule, sassRuleModules } from "./rules";

async function prepareWebpack(webpack: WebpackConfigure, config: BuildConfigure, options: ExtenderSassOptions) {
	if (!webpack.module) {
		webpack.module = {};
	}
	if (!webpack.module.rules) {
		webpack.module.rules = [];
	}

	const rules = webpack.module.rules;
	let index = rules.findIndex((rule) => isCssRule(rule, true));
	let indexModules = rules.findIndex((rule) => isCssRule(rule, false));
	if (indexModules > index) {
		index = indexModules;
	}
	if (index === -1) {
		throw new Error("Use css extender before sass");
	}

	if (!rules.some((rule) => isScssRule(rule))) {
		rules.push(await sassRule(config, options));
	}

	const { modules = true } = options;
	if (modules && !rules.some((rule) => isScssRule(rule, true))) {
		rules.push(await sassRuleModules(config, modules));
	}
}

export function extender(options: ExtenderSassOptions = {}): BuildExtenderResult {
	return {
		docTypeReference: ["@phragon/extender-sass"],
		async onWebpackConfigure(event) {
			await prepareWebpack(event.webpack, event.config, options);
		},
	};
}
