export {default as Pattern} from "./Pattern";
export {addModifier, compilePath} from "./compilePath";
export {default as matchPath} from "./matchPath";
export {default as pathToPattern} from "./pathToPattern";
export {default as matchToPath} from "./matchToPath";

export type {
	PatternInterface,
	PathToPatternOptions,
	PatternFormatter,
	PatternFormatterArgument,
	PatternRegExArgument,
	AddModifierOptions,
} from "./types";