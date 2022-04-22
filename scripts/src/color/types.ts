export type ModifierName = "bold" | "dim" | "italic" | "underline" | "blink" | "reverse" | "hidden";

// prettier-ignore
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
