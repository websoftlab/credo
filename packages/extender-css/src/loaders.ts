import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { postcssConfig } from "./configs";
import type { WebpackBuildLoaderRule, BuildConfigure } from "phragon";

export function cssLoader(config: BuildConfigure, options?: unknown): WebpackBuildLoaderRule {
	return {
		loader: "css-loader",
		options: {
			...(options != null ? options : null),
			sourceMap: config.isDev,
		},
	};
}

export async function postCssLoader(
	config: BuildConfigure,
	options?: unknown,
	postcssOptions?: unknown,
	modules: boolean = false
): Promise<WebpackBuildLoaderRule> {
	return {
		loader: "postcss-loader",
		options: {
			...(options != null ? options : null),
			postcssOptions: {
				...(await postcssConfig(config, postcssOptions, modules)),
			},
			sourceMap: config.isDev,
		},
	};
}

/***
 * Using MiniCssExtractPlugin in production or style-loader in development
 * @see https://webpack.js.org/plugins/mini-css-extract-plugin/#root
 * @see https://webpack.js.org/loaders/style-loader/#root
 */
export function miniCssExtractLoader(config: BuildConfigure, options?: unknown): WebpackBuildLoaderRule {
	return {
		loader: config.isDevServer ? "style-loader" : MiniCssExtractPlugin.loader,
		options: {
			...(options != null ? options : null),
			esModule: false,
		},
	};
}
