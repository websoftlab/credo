import type { ExtenderSassOptions, ExtenderSassModulesOptions } from "./types";
import { WebpackBuildRule, BuildConfigure } from "phragon";
import { cssLoader, miniCssExtractLoader, postCssLoader } from "@phragon/extender-css";
import { sassLoader, sassLoaderBootstrap } from "./loaders";

type TypeOf = "sass" | "sass-modules";

const isScss = Symbol("sass.rule");
const types = {
	sass: 1,
	"sass-modules": 2,
};

export function isScssRule(rule: any, modules?: boolean): rule is WebpackBuildRule {
	return rule != null && typeof rule === "object" && rule[isScss] === (modules ? types["sass-modules"] : types.sass);
}

function onType(object: WebpackBuildRule & { [isScss]?: number }, type: TypeOf) {
	object[isScss] = types[type];
	return object;
}

/** sass **/

export async function sassRule(config: BuildConfigure, options: ExtenderSassOptions): Promise<WebpackBuildRule> {
	const { test, exclude: cssExclude, issuer, loaderOptions = {}, postCssOptions, modules = true } = options;
	const { css, sass, style, postcss, miniCssExtractor } = loaderOptions;

	let exclude = cssExclude;
	if (!exclude && modules) {
		if (typeof modules === "object" && modules.test) {
			exclude = modules.test;
		} else {
			exclude = /\.module.s([ca])ss$/;
		}
	}

	return onType(
		await config.fireOnOptionsHook("module.rule.sass", {
			test: test || /\.s([ca])ss$/,
			exclude,
			issuer,
			use: [
				miniCssExtractLoader(config, config.isDevServer ? style : miniCssExtractor),
				cssLoader(config, css),
				await postCssLoader(config, postcss, postCssOptions),
				sassLoader(config, sass),
				sassLoaderBootstrap(config),
			],
		}),
		"sass"
	);
}

export async function sassRuleModules(
	config: BuildConfigure,
	options: true | string | ExtenderSassModulesOptions
): Promise<WebpackBuildRule> {
	if (options === true) {
		options = {};
	} else if (typeof options === "string") {
		options = { modules: options };
	}

	const { isDev } = config;
	const { test, exclude, issuer, loaderOptions = {}, postCssOptions, modules } = options;
	const { css, sass, style, postcss, miniCssExtractor } = loaderOptions;

	return onType(
		await config.fireOnOptionsHook("module.rule.sass:modules", {
			test: test || /\.module\.s([ca])ss$/,
			exclude,
			issuer,
			use: [
				miniCssExtractLoader(config, config.isDevServer ? style : miniCssExtractor),
				cssLoader(config, {
					...(css != null ? css : null),
					modules: isDev
						? {
								localIdentName:
									typeof modules === "string" ? modules : "[name]__[local]--[hash:base64:5]",
						  }
						: true,
					importLoaders: 3,
				}),
				await postCssLoader(config, postcss, postCssOptions, true),
				sassLoader(config, sass),
				sassLoaderBootstrap(config),
			],
		}),
		"sass-modules"
	);
}
