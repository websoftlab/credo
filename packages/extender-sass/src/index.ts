import { extender } from "./extender";

export { sassLoaderBootstrap, sassLoader } from "./loaders";
export { sassRule, sassRuleModules, isScssRule } from "./rules";
export { extender };
export default extender;

export type { ExtenderSassModulesOptions, ExtenderSassOptions, ExtenderCassLoaderOptions } from "./types";
