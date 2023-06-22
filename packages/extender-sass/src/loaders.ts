import type { BuildConfigure, WebpackBuildLoaderRule } from "phragon";
import { join as joinPath } from "path";

/**
 * Sass loader with sass-resources-loader
 */
export function sassLoader(config: BuildConfigure, options?: unknown): WebpackBuildLoaderRule {
	return {
		loader: "sass-loader",
		options: {
			...(options != null ? options : null),
			sourceMap: config.isDev,
			implementation: require("sass"),
		},
	};
}

export function sassLoaderBootstrap(config: BuildConfigure): WebpackBuildLoaderRule {
	const { cwd } = config;
	return {
		loader: joinPath(__dirname, "./util/sass-bootstrap-transform-loader.js"),
		options: {
			cwdPath: cwd,
		},
	};
}
