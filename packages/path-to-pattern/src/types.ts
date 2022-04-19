export interface PathToPatternOptions {
	cacheable?: boolean;
}

export interface PatternInterface<R = any> {
	readonly path: string;
	readonly keys: string[];
	readonly length: number;
	match(path: string, options?: MatchOptions): false | R;
	matchToPath(options?: MatchToPathOptions<R>): string;
}

export interface AddModifierOptions {
	regExp?: PatternRegExArgument;
	formatter?: PatternFormatterArgument;
}

type EncodeDecodeFunction = (path: string) => string;

export interface MatchOptions {
	decode?: boolean | EncodeDecodeFunction;
}

export interface MatchToPathOptions<R = any> {
	data?: R;
	encode?: boolean | EncodeDecodeFunction;
}

export type PatternRegExArgument = string | ((args: string[]) => string);

export type PatternFormatterArgument = (args: string[]) => (undefined | PatternFormatter);

export type PatternFormatter = (value: string) => (boolean | {value: any});