import { babel } from "../config";
import type { BuildLoaderRule } from "../types";
import type { BuildConfigure } from "../../types";

async function babelLoader(config: BuildConfigure): Promise<BuildLoaderRule> {
	return {
		loader: "babel-loader",
		options: {
			...(await babel(config)),
		},
	};
}

export { babelLoader };
