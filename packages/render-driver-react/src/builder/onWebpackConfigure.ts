import type { BuildConfigure } from "phragon";
import { babelLoader } from "phragon/webpack/rules/use-loader-rule-items";

export default async function onWebpackConfigure(config: any, options: BuildConfigure): Promise<void> {
	const { isDevServer } = options;
	if (isDevServer) {
		if (!config.plugins) {
			config.plugins = [];
		}
		const plugin = await import("@pmmmwh/react-refresh-webpack-plugin");
		const ReactRefreshPlugin = plugin.default || plugin.ReactRefreshPlugin;
		config.plugins.push(
			new ReactRefreshPlugin({
				overlay: false,
			})
		);
	}

	if (!config.module) {
		config.module = {};
	}
	if (!config.module.rules) {
		config.module.rules = [];
	}

	/**
	 * Using @svgr/webpack for handling svg files in react components
	 * @see https://react-svgr.com/docs/webpack/
	 */
	config.module.rules.push({
		test: /\.component\.svg$/,
		issuer: /\.[jt]sx$/,
		use: [
			await babelLoader(options),
			{
				loader: "@svgr/webpack",
				options: {
					babel: false,
					icon: true,
				},
			},
		],
	});
}
