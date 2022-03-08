import type {BuildConfigure, CredoPluginRenderDriver} from "credo";
import {babelLoader} from "credo/webpack/rules/use-loader-rule-items";

export default <CredoPluginRenderDriver>{
	name: "react",
	extensions: {
		all: [".ts", ".tsx", ".js", ".jsx"],
		javascript: [".jsx"],
		typescript: [".tsx"],
	},
	clientDependencies: [
		"@credo-js/html-head",
		"@credo-js/render-driver-react/app",
		"@credo-js/render-driver-react/head",
	],
	hooks: {
		// todo add jsx to tsconfig.json file
		async onWebpackConfigure(config: any, options: BuildConfigure): Promise<void> {
			const {isDevServer} = options;
			if(isDevServer) {
				if(!config.plugins) {
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

			if(!config.module) {
				config.module = {};
			}
			if(!config.module.rules) {
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
						loader: '@svgr/webpack',
						options: {
							babel: false,
							icon: true,
						},
					},
				],
			});
		},
		onOptions<T = any>(event: { name: string; option: T }): void {
			if(event.name !== "config.babel") {
				return;
			}

			const babelConfig: any = event.option;
			if(!babelConfig.presets) {
				babelConfig.presets = [];
			}

			const presets: Array<string | [string, any]> = babelConfig.presets;
			const index = presets.findIndex(item => {
				if(typeof item === "string") {
					return item === "@babel/preset-env";
				}
				if(Array.isArray(item)) {
					return item[0] === "@babel/preset-env";
				}
			});

			// preset React
			const presetReact: [string, any] = [
				"@babel/preset-react", {
					"runtime": "automatic",
				}
			];

			if(index === -1) {
				presets.push(presetReact);
			} else {
				presets.splice(index, 0, presetReact);
			}
		}
	}
};