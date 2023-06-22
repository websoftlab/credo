import type { BuildConfigure, WebpackConfigure, BuildExtenderResult } from "phragon";
import type { ExtenderCssOptions } from "./types";
import { cssRule, cssRuleModules, isCssRule } from "./rules";
import MiniCssExtractPlugin from "mini-css-extract-plugin";

const cacheGroupsStyles: any = {
	name: "styles",
	type: "css/mini-extract",
	chunks: "all",
	enforce: true,
	minSize: 0,
};

async function prepareWebpack(webpack: WebpackConfigure, config: BuildConfigure, options: ExtenderCssOptions) {
	if (!webpack.module) {
		webpack.module = {};
	}
	if (!webpack.module.rules) {
		webpack.module.rules = [];
	}

	const rules = webpack.module.rules;
	const { modules = true, miniCssPluginOptions = null } = options;
	let isPlugin = false;
	let isOptimization = false;

	if (!rules.some((rule) => isCssRule(rule))) {
		rules.push(await cssRule(config, options));
		isPlugin = !config.isDevServer;
		isOptimization = config.isServer || config.isProd;
	}

	if (modules && !rules.some((rule) => isCssRule(rule, true))) {
		rules.push(await cssRuleModules(config, modules));
	}

	if (isPlugin) {
		if (!webpack.plugins) {
			webpack.plugins = [];
		}
		webpack.plugins.push(
			new MiniCssExtractPlugin({
				// Options similar to the same options in webpackOptions.output
				// both options are optional
				filename: "[name].[fullhash].css",
				chunkFilename: "styles/[id].[fullhash].css",
				...miniCssPluginOptions,
			})
		);
	}

	if (isOptimization) {
		// optimization
		if (!webpack.optimization) {
			webpack.optimization = {};
		}
		const { optimization } = webpack;
		if (!optimization.splitChunks) {
			optimization.splitChunks = {};
		}
		if (!optimization.splitChunks.cacheGroups) {
			optimization.splitChunks.cacheGroups = {};
		}
		optimization.splitChunks.cacheGroups.styles = cacheGroupsStyles;
	}
}

export function extender(options: ExtenderCssOptions = {}): BuildExtenderResult {
	return {
		docTypeReference: ["@phragon/extender-css"],
		async onWebpackConfigure(event) {
			await prepareWebpack(event.webpack, event.config, options);
		},
	};
}
