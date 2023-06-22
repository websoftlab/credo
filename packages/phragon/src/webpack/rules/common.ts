import { babelLoader } from "./use-loader-rule-items";
import { existsStat } from "../../utils";
import type { BuildRule } from "../types";
import type { BuildConfigure } from "../../types";

export function createExtensions(extensions: string[], renderDriverExtensions?: string[]) {
	if (renderDriverExtensions) {
		for (let ext of renderDriverExtensions) {
			const m = ext.match(/^\.([a-z]+)$/);
			if (m && !extensions.includes(m[1])) {
				extensions.push(m[1]);
			}
		}
	}
	return new RegExp("\\.(?:" + extensions.join("|") + ")$");
}

/**
 * @see https://webpack.js.org/guides/typescript/#loader
 */
async function typescriptRule(config: BuildConfigure): Promise<BuildRule> {
	const {
		factory: { render },
	} = config;
	const options: any = {
		transpileOnly: true,
	};

	let stat = await existsStat("./tsconfig-client.json");
	if (!stat || !stat.isFile) {
		stat = await existsStat("./tsconfig.json");
	}

	if (stat && stat.isFile) {
		options.configFile = stat.file;
	} else if (render?.name === "react") {
		options.compilerOptions = {
			jsx: "react-jsx",
		};
	}

	return config.fireOnOptionsHook("module.rule.typescript", {
		test: createExtensions(["ts"], render?.extensions?.typescript),
		loader: "ts-loader",
		options,
		exclude: /node_modules/,
	});
}

/**
 * @see https://webpack.js.org/loaders/babel-loader
 */
async function javascriptRule(config: BuildConfigure): Promise<BuildRule> {
	const {
		factory: { render },
	} = config;
	return config.fireOnOptionsHook("module.rule.javascript", {
		test: createExtensions(["js"], render?.extensions?.javascript),
		use: [await babelLoader(config)],
		exclude: /node_modules/,
	});
}

export { typescriptRule, javascriptRule };
