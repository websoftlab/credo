import type { BuildConfigure } from "phragon";

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
}
