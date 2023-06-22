import { extender } from "./extender";

export { postcssConfig } from "./configs";
export { cssLoader, miniCssExtractLoader, postCssLoader } from "./loaders";
export { cssRule, cssRuleModules, isCssRule } from "./rules";
export { extender };
export default extender;

export type { ExtenderCssOptions, ExtenderCssModulesOptions, ExtenderCssLoaderOptions } from "./types";
