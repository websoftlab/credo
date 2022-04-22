import type { BuildRule } from "../types";
import type { BuildConfigure } from "../../types";

/**
 * Using file-loader for handling svg files
 * @see https://webpack.js.org/guides/asset-modules/
 */
async function svgRule(config: BuildConfigure): Promise<BuildRule> {
	return config.fireOnOptionsHook("module.rule.svg", {
		test: /\.svg$/,
		exclude: /\.component\.svg$/,
		type: "asset",
		generator: {
			filename: "images/[name].[hash][ext]",
		},
		parser: {
			dataUrlCondition: {
				maxSize: 4 * 1024, // 4kb
			},
		},
	});
}

export { svgRule };
