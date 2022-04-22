import { cssLoader, miniCssExtractLoader, postCssLoader, sassLoaderItems } from "./use-loader-rule-items";
import type { BuildRule } from "../types";
import type { BuildConfigure } from "../../types";

/** css **/
async function cssRule(config: BuildConfigure): Promise<BuildRule> {
	return config.fireOnOptionsHook("module.rule.css", {
		test: /\.css$/,
		use: [miniCssExtractLoader(config), cssLoader(config), await postCssLoader(config)],
	});
}

/** sass **/
async function sassModulesRule(config: BuildConfigure): Promise<BuildRule> {
	const { isDev } = config;
	return {
		test: /\.module\.s([ca])ss$/,
		use: [
			miniCssExtractLoader(config),
			cssLoader(config, {
				modules: isDev
					? {
							localIdentName: "[name]__[local]--[hash:base64:5]",
					  }
					: true,
				importLoaders: 3,
			}),
			await postCssLoader(config),
			...sassLoaderItems(config),
		],
	};
}

async function sassRule(config: BuildConfigure): Promise<BuildRule> {
	return {
		test: /\.s([ca])ss$/,
		exclude: /\.module.s([ca])ss$/,
		use: [miniCssExtractLoader(config), cssLoader(config), await postCssLoader(config), ...sassLoaderItems(config)],
	};
}

async function sassRules(config: BuildConfigure): Promise<BuildRule[]> {
	return [await sassModulesRule(config), await sassRule(config)];
}

export { cssRule, sassModulesRule, sassRule, sassRules };
