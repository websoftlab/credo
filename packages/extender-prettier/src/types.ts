import type { Options } from "prettier";

export type ExtenderPrettierParserName = "css" | "scss" | "less" | "html" | "yaml";

export interface ExtenderPrettierOptions {
	options?: Options;
	version?: string;
	scriptName?: string | false;
	parser?: ExtenderPrettierParserName[];
}
