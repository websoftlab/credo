import type { BuildRule } from "../types";
import type { BuildConfigure } from "../../types";
import { createExtensions } from "./common";

/**
 * Using file-loader for handling svg files
 * @see https://webpack.js.org/guides/asset-modules/
 */
async function replaceRule(config: BuildConfigure): Promise<BuildRule> {
	const {
		mode,
		isServer,
		isClient,
		isProd,
		isDev,
		factory: { render },
	} = config;
	const func: Record<string, string | boolean | number> = {
		isSrv: isServer,
		isWeb: isClient,
		isDev: isDev,
		isProd: isProd,
		env: mode,
	};
	return config.fireOnOptionsHook("module.rule.replace", {
		test: createExtensions(["js", "ts"], render?.extensions?.typescript),
		loader: "string-replace-loader",
		exclude: /node_modules[\/\\]@phragon[\/\\]utils/,
		options: {
			search: "__(\\w+)__\\s*\\(\\s*\\)",
			flags: "g",
			replace(match: string, name: string) {
				if (func.hasOwnProperty(name)) {
					const value = func[name];
					switch (typeof value) {
						case "number":
							return value;
						case "string":
							return JSON.stringify(value);
						case "boolean":
							return value ? "true" : "false";
						default:
							return '""';
					}
				}
				return match;
			},
		},
	});
}

export { replaceRule };
