import type { Configuration } from "webpack";
import { cleanWebpackPlugin, miniCssExtractPlugin } from "./plugins";
import type { BuildConfigure } from "../types";

export default function (config: BuildConfigure): Configuration {
	return {
		output: config.isServer
			? {}
			: {
					publicPath: "/",
			  },
		performance: {
			hints: false,
			maxEntrypointSize: 512000,
			maxAssetSize: 512000,
		},
		plugins: [cleanWebpackPlugin(config), miniCssExtractPlugin(config) as any],
	};
}
