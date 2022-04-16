import type {CredoPlugin} from "credo";
import prepareBabelConfig from "./prepareBabelConfig";
import onWebpackConfigure from "./onWebpackConfigure";
import tsConfigCompilerOptionsJSX from "./tsConfigCompilerOptionsJSX";

export default <Omit<CredoPlugin.RenderDriver, "modulePath">>{
	name: "react",
	extensions: {
		all: [".ts", ".tsx", ".js", ".jsx"],
		javascript: [".jsx"],
		typescript: [".tsx"],
	},
	clientDependencies: [
		"@credo-js/html-head",
		"@credo-js/app",
		"@credo-js/render-driver-react/app",
		"@credo-js/render-driver-react/head",
	],
	hooks: {
		onBuild(options: CredoPlugin.Factory): void | Promise<void> {
			return tsConfigCompilerOptionsJSX(options.root.pluginPath);
		},
		onWebpackConfigure,
		onOptions<T = any>(event: { name: string; option: T }): void {
			switch (event.name) {
				case "config.babel": return prepareBabelConfig(event.option);
			}
		}
	}
};