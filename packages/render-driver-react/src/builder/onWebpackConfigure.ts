import type { BuildConfigure } from "phragon";
import { babelLoader } from "phragon/webpack/rules/use-loader-rule-items";

export default async function onWebpackConfigure(event: { webpack: any; config: BuildConfigure }): Promise<void> {
	const {
		webpack,
		config: { isDevServer },
	} = event;

	if (isDevServer) {
		if (!webpack.plugins) {
			webpack.plugins = [];
		}
		const plugin = await import("@pmmmwh/react-refresh-webpack-plugin");
		const ReactRefreshPlugin = plugin.default || plugin.ReactRefreshPlugin;
		webpack.plugins.push(
			new ReactRefreshPlugin({
				overlay: false,
			})
		);
	}

	if (!webpack.module) {
		webpack.module = {};
	}
	if (!webpack.module.rules) {
		webpack.module.rules = [];
	}

	/**
	 * Using @svgr/webpack for handling svg files in react components
	 * @see https://react-svgr.com/docs/webpack/
	 */
	webpack.module.rules.push({
		test: /\.component\.svg$/,
		issuer: /\.[jt]sx$/,
		use: [
			await babelLoader(event.config),
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
