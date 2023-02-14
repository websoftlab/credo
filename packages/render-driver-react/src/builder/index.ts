import type { BuildConfigure, PhragonPlugin } from "phragon";
import prepareBabelConfig from "./prepareBabelConfig";
import prepareRollupTsConfig from "./prepareRollupTsConfig";
import onWebpackConfigure from "./onWebpackConfigure";
import tsConfigCompilerOptionsJSX from "./tsConfigCompilerOptionsJSX";

export default <Omit<PhragonPlugin.RenderDriver, "modulePath">>{
	name: "react",
	extensions: {
		all: [".ts", ".tsx", ".js", ".jsx"],
		javascript: [".jsx"],
		typescript: [".tsx"],
	},
	dependencies: {
		"@phragon/loadable": "*",
		"@phragon/app": "*",
		mobx: "^6.4.0",
		"mobx-react-lite": "^3.4.0",
		react: "^18.1.0",
		"react-dom": "^18.1.0",
	},
	devDependencies: {
		"@types/react": "^18.0.12",
		"@types/react-dom": "^18.0.5",
		"@babel/preset-react": "^7.16.7",
		"@pmmmwh/react-refresh-webpack-plugin": "^0.5.4",
		"react-refresh": "^0.10.0",
	},
	clientDependencies: [],
	hooks: {
		onBuild(options: PhragonPlugin.Factory): void | Promise<void> {
			return tsConfigCompilerOptionsJSX(options.root.cwd);
		},
		onWebpackConfigure,
		onOptions<T = any>(event: { name: string; option: T; config: BuildConfigure }): void {
			switch (event.name) {
				case "config.babel":
					return prepareBabelConfig(event.option);
				case "plugin.typescript":
					if (event.config.builderType === "rollup") {
						prepareRollupTsConfig(event.option);
					}
					break;
			}
		},
	},
};
