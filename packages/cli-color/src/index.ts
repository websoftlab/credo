import type {Mixed, ColorName, ModifierColorName} from "./types";

const regColor = /{([a-zA-Z.]+) (.+?)}/g;
const regVar = /%s/g;

const colorReset = "\x1b[0m";
const colors: Partial<Record<ModifierColorName, string>> = {
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",
	underline: "\x1b[4m",
	blink: "\x1b[5m",
	reverse: "\x1b[7m",
	hidden: "\x1b[8m",
};

const CSI = "\x1b[";
const sgr = (code: number) => CSI + code + "m";

const set = (name: ModifierColorName, code: number) => {
	colors[name] = sgr(code);
};

const setMx = (color: ModifierColorName, index: number) => {
	set(color, 30 + index);
	set("bg" + color[0].toUpperCase() + color.slice(1) as ModifierColorName, 40 + index);
	set("bg" + color[0].toUpperCase() + color.slice(1) + "Bright" as ModifierColorName, 100 + index);
};

const clr1: ColorName[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "gray"];
const clr2: ColorName[] = ["darkGray", "lightRed", "lightGreen", "lightYellow", "lightBlue", "lightMagenta", "lightCyan", "white"];

clr1.forEach((color, index) => {
	setMx(color, index);
	if(color === "gray") {
		setMx("grey", index);
	}
});

clr2.forEach((color, index) => {
	set(color, 90 + index);
	if(color === "darkGray") {
		set("darkGrey", 90 + index);
	}
});

export function isModifierColorName(name: string | symbol): name is ModifierColorName {
	return colors.hasOwnProperty(name);
}

function colorMap(list: ModifierColorName[], text: string) {
	if(!text) {
		return "";
	}
	if(!process.stdout.isTTY || !list.length) {
		return text;
	}
	let prefix = "";
	for(const color of list) {
		prefix += colors[color];
	}
	return prefix + text + colorReset;
}

function colorRs(full: string, a: string, b: string) {
	let n = 0;
	let text = "";
	const repeat: string[] = [];
	a.split(".").forEach(color => {
		if(isModifierColorName(color) && !repeat.includes(color)) {
			n ++;
			if(process.stdout.isTTY) {
				text += colors[color];
			}
			repeat.push(color);
		}
	});
	if(n < 1) {
		return full;
	}
	text += b;
	if(process.stdout.isTTY) {
		text += colorReset;
	}
	return text;
}

function createProxy<T extends object = {}>(target?: T, colors: ModifierColorName[] = []): T {
	if(!target) {
		target = {} as T;
	}
	return new Proxy(target, {
		get(_, p) {
			if(isModifierColorName(p)) {
				const copyColors = colors.includes(p) ? colors.slice() : colors.concat([p]);
				return createProxy((text: string) => { return colorMap(copyColors, text); }, copyColors);
			}
		}
	});
}

export const mixed = createProxy<Mixed>();

export function color(name: string, text: string) {
	return isModifierColorName(name) ? (colors[name] + text + colorReset) : text;
}

export function newError(message: string, ... args: (string | number)[] | [(string | number)[]]): Error {
	return new Error( replace(message, ... args) );
}

// ex. color("text {red text}")
// ex. color("text {bgWhite.red.bold %s}", ["text"]);

export function replace(message: string, ... args: (string | number)[] | [(string | number)[]]) {
	message = message.replace(regColor, colorRs);
	if(args.length) {
		if(args.length === 1 && Array.isArray(args[0])) {
			args = args[0];
		}
		let i = 0;
		message = message.replace(regVar, () => String(args[i++]));
	}
	return message;
}

export type {ModifierColorName, ModifierName, ColorName, Mixed} from "./types";