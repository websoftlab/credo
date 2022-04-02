import type {BuildConfigure} from "../types";
import type {Configuration} from "webpack";
import {devServer} from './config';
import {cleanWebpackPlugin, miniCssExtractPlugin} from './plugins';

export default function(config: BuildConfigure): Configuration & {devServer?: any} {
	const {isDevServer} = config;
	if(!isDevServer) {
		return {
			output: {
				publicPath: "/"
			},
			plugins: [
				cleanWebpackPlugin(config),
				miniCssExtractPlugin(config) as any,
			],
		}
	}
	const dev = devServer(config);
	return {
		output: {
			publicPath: dev.url
		},
		devtool: 'cheap-module-source-map',
		plugins: [],
		devServer: dev.config,
	};
};