export type ModifierName =
	| "bold"
	| "dim"
	| "italic"
	| "underline"
	| "blink"
	| "reverse"
	| "hidden";

export type ColorName =
	| "black"
	| "white"
	| "red"     | "lightRed"     | "bgRed"     | "bgRedBright"
	| "green"   | "lightGreen"   | "bgGreen"   | "bgGreenBright"
	| "yellow"  | "lightYellow"  | "bgYellow"  | "bgYellowBright"
	| "blue"    | "lightBlue"    | "bgBlue"    | "bgBlueBright"
	| "magenta" | "lightMagenta" | "bgMagenta" | "bgMagentaBright"
	| "cyan"    | "lightCyan"    | "bgCyan"    | "bgCyanBright"
	| "gray"    | "darkGray"     | "bgGray"    | "bgGrayBright"
	| "grey"    | "darkGrey"     | "bgGrey"    | "bgGreyBright"
;

export type ModifierColorName = ModifierName | ColorName;

export interface Palette extends Record<ModifierColorName, (text: string) => string> {
	(name: ModifierColorName, text: string): string;
}

export interface Mixed extends Record<ModifierColorName, Mixed> {
	(text: string): string;
}