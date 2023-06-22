import type { BuildConfigure, WebpackConfigure, BuildExtenderResult } from "phragon";
import type { ExtenderResourceOptions } from "./types";
import { isResourceRule, imagesRule, fontsRule, svgRule } from "./rules";

async function prepareWebpack(webpack: WebpackConfigure, config: BuildConfigure, options: ExtenderResourceOptions) {
	if (!webpack.module) {
		webpack.module = {};
	}
	if (!webpack.module.rules) {
		webpack.module.rules = [];
	}

	const rules = webpack.module.rules;
	const { image = true, font = true, svg = true } = options;

	if (image && !rules.some((rule) => isResourceRule(rule, "image"))) {
		rules.push(await imagesRule(config, image));
	}
	if (font && !rules.some((rule) => isResourceRule(rule, "font"))) {
		rules.push(await fontsRule(config, font));
	}
	if (svg && !rules.some((rule) => isResourceRule(rule, "svg"))) {
		rules.push(await svgRule(config, svg));
	}
}

export function extender(options: ExtenderResourceOptions = {}): BuildExtenderResult {
	return {
		docTypeReference: ["@phragon/extender-resource"],
		async onWebpackConfigure(event) {
			await prepareWebpack(event.webpack, event.config, options);
		},
	};
}
