import type { PluginOptions } from "mini-css-extract-plugin";

type Tester = RegExp | ((value: string) => boolean);

export interface ExtenderCssLoaderOptions {
	css?: unknown;
	style?: unknown;
	miniCssExtractor?: unknown;
	postcss?: unknown;
}

export interface ExtenderCssOptions {
	test?: Tester;
	exclude?: Tester;
	issuer?:
		| Tester
		| {
				not: Tester | Tester[];
		  };
	modules?: string | boolean | ExtenderCssModulesOptions;
	loaderOptions?: ExtenderCssLoaderOptions;
	postCssOptions?: unknown;
	miniCssPluginOptions?: PluginOptions;
}

export interface ExtenderCssModulesOptions extends Omit<ExtenderCssOptions, "modules"> {
	modules?: string;
}
