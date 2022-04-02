import type {Configuration} from "webpack";
import type {BuildConfigure} from "../types";

// @ts-ignore
import TerserJSPlugin from 'terser-webpack-plugin';

const cacheGroupsStyles: any = {
	name: "styles",
	type: "css/mini-extract",
	chunks: "all",
	enforce: true,
	minSize: 0,
};

export default async function optimization(config: BuildConfigure): Promise<Configuration["optimization"]> {
	const {isServer, isProd} = config;
	if(isServer) {
		return {
			minimize: false,
			splitChunks: {
				cacheGroups: {
					styles: cacheGroupsStyles
				}
			}
		};
	}

	const optimization: Configuration["optimization"] = {
		minimize: false,
		runtimeChunk: {
			name: 'runtime',
		},
		splitChunks: {
			cacheGroups: {
				commons: {
					test: /[\\/]node_modules[\\/]/,
					name: 'vendor',
					chunks: 'initial',
				},
			},
		}
	};

	if(isProd) {
		optimization.minimize = true;
		optimization.minimizer = [
			new TerserJSPlugin(await config.fireOnOptionsHook("plugin.terser", {
				parallel: true,
			})),
		];
		(optimization.splitChunks as any).cacheGroups.styles = cacheGroupsStyles;
	}

	return optimization;
}
