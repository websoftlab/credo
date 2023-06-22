import type { BuildConfigure, WebpackBuildRule } from "phragon";
import type { ExtendResourceType } from "./types";

type TypeOf = "image" | "font" | "svg";

const isResource = Symbol("resource.rule");
const types = {
	image: 1,
	font: 2,
	svg: 3,
};

function onType(object: WebpackBuildRule & { [isResource]?: number }, type: TypeOf) {
	object[isResource] = types[type];
	return object;
}

export function isResourceRule(rule: any, type?: TypeOf): rule is WebpackBuildRule {
	const id = rule != null && typeof rule === "object" ? rule[isResource] : null;
	if (id == null) {
		return false;
	}
	if (!type) {
		return true;
	}
	return id === types[type];
}

function getOptions(options: true | ExtendResourceType): ExtendResourceType {
	return typeof options === "object" && options != null ? options : {};
}

/**
 * @see https://webpack.js.org/guides/asset-modules/
 */
export async function imagesRule(
	config: BuildConfigure,
	options: true | ExtendResourceType
): Promise<WebpackBuildRule> {
	const { generator, test, parser, exclude, issuer } = getOptions(options);
	return onType(
		await config.fireOnOptionsHook("module.rule.images", {
			exclude,
			issuer,
			parser,
			test: test || /\.(?:ico|gif|png|jpg|jpeg)$/i,
			type: "asset/resource",
			generator: {
				filename: "images/[name].[hash][ext]",
				...generator,
			},
		}),
		"image"
	);
}

/**
 * @see https://webpack.js.org/guides/asset-modules/
 */
export async function fontsRule(config: BuildConfigure, options: true | ExtendResourceType): Promise<WebpackBuildRule> {
	const { generator, test, parser, exclude, issuer } = getOptions(options);
	return onType(
		await config.fireOnOptionsHook("module.rule.fonts", {
			exclude,
			issuer,
			parser,
			test: test || /\.(woff(2)?|eot|ttf|otf)$/,
			type: "asset/resource",
			generator: {
				filename: "fonts/[name].[hash][ext]",
				...generator,
			},
		}),
		"font"
	);
}

/**
 * Using file-loader for handling svg files
 * @see https://webpack.js.org/guides/asset-modules/
 */
export async function svgRule(config: BuildConfigure, options: true | ExtendResourceType): Promise<WebpackBuildRule> {
	const { generator, test, parser = {}, exclude, issuer } = getOptions(options);
	const { dataUrlCondition, ...rest } = parser;
	return onType(
		await config.fireOnOptionsHook("module.rule.svg", {
			exclude,
			issuer,
			test: test || /\.svg$/,
			type: "asset",
			generator: {
				filename: "images/[name].[hash][ext]",
				...generator,
			},
			parser: {
				...rest,
				dataUrlCondition: {
					maxSize: 4 * 1024, // 4kb
					...dataUrlCondition,
				},
			},
		}),
		"svg"
	);
}
