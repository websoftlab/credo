import type { ExtenderCssOptions, ExtenderCssLoaderOptions } from "@phragon/extender-css";

export interface ExtenderCassLoaderOptions extends ExtenderCssLoaderOptions {
	sass?: unknown;
}

export interface ExtenderSassOptions
	extends Omit<ExtenderCssOptions, "modules" | "loaderOptions" | "miniCssPluginOptions"> {
	modules?: string | boolean | ExtenderSassModulesOptions;
	loaderOptions?: ExtenderCassLoaderOptions;
}

export interface ExtenderSassModulesOptions extends Omit<ExtenderSassOptions, "modules"> {
	modules?: string;
}
