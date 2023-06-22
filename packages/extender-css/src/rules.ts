import { cssLoader, miniCssExtractLoader, postCssLoader } from "./loaders";
import type { WebpackBuildRule, BuildConfigure } from "phragon";
import type { ExtenderCssOptions, ExtenderCssModulesOptions } from "./types";

type TypeOf = "css" | "css-modules";

const isCss = Symbol("css.rule");
const types = {
	css: 1,
	"css-modules": 2,
};

export function isCssRule(rule: any, modules?: boolean): rule is WebpackBuildRule {
	return rule != null && typeof rule === "object" && rule[isCss] === (modules ? types["css-modules"] : types.css);
}

function onType(object: WebpackBuildRule & { [isCss]?: number }, type: TypeOf) {
	object[isCss] = types[type];
	return object;
}

export async function cssRule(config: BuildConfigure, options: ExtenderCssOptions): Promise<WebpackBuildRule> {
	const { test, exclude: cssExclude, issuer, loaderOptions = {}, postCssOptions, modules = true } = options;
	const { css, style, postcss, miniCssExtractor } = loaderOptions;

	let exclude = cssExclude;
	if (!exclude && modules) {
		if (typeof modules === "object" && modules.test) {
			exclude = modules.test;
		} else {
			exclude = /\.module\.css$/;
		}
	}

	return onType(
		await config.fireOnOptionsHook("module.rule.css", {
			test: test || /\.css$/,
			exclude,
			issuer,
			use: [
				miniCssExtractLoader(config, config.isDevServer ? style : miniCssExtractor),
				cssLoader(config, css),
				await postCssLoader(config, postcss, postCssOptions),
			],
		}),
		"css"
	);
}

export async function cssRuleModules(config: BuildConfigure, options: true | string | ExtenderCssModulesOptions) {
	if (options === true) {
		options = {};
	} else if (typeof options === "string") {
		options = { modules: options };
	}

	const { isDev } = config;
	const { test, exclude, issuer, loaderOptions = {}, postCssOptions, modules } = options;
	const { css, style, postcss, miniCssExtractor } = loaderOptions;

	return onType(
		await config.fireOnOptionsHook("module.rule.css:modules", {
			test: test || /\.module\.css$/,
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
				}),
				await postCssLoader(config, postcss, postCssOptions, true),
			],
		}),
		"css-modules"
	);
}
