import type { PhragonPlugin } from "phragon";
import prepareBabelConfig from "./prepareBabelConfig";
import onWebpackConfigure from "./onWebpackConfigure";
import tsConfigCompilerOptionsJSX from "./tsConfigCompilerOptionsJSX";

export default <Omit<PhragonPlugin.RenderDriver, "modulePath">>{
	name: "react",
	extensions: {
		all: [".ts", ".tsx", ".js", ".jsx"],
		javascript: [".jsx"],
		typescript: [".tsx"],
	},
	devDependencies: {
		"@types/history": "^4.7.9",
		"@types/react": "^17.0.16",
		"@types/react-dom": "^17.0.9",
		"@types/react-router-dom": "^5.1.8",
		"@babel/preset-react": "^7.16.7",
		"@pmmmwh/react-refresh-webpack-plugin": "^0.5.4",
		"react-refresh": "^0.10.0",
	},
	clientDependencies: [
		"@phragon/html-head",
		"@phragon/app",
		"@phragon/render-driver-react/app",
		"@phragon/render-driver-react/head",
	],
	hooks: {
		onBuild(options: PhragonPlugin.Factory): void | Promise<void> {
			return tsConfigCompilerOptionsJSX(options.root.pluginPath);
		},
		onWebpackConfigure,
		onOptions<T = any>(event: { name: string; option: T }): void {
			switch (event.name) {
				case "config.babel":
					return prepareBabelConfig(event.option);
			}
		},
	},
};
