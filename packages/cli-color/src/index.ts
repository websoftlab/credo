import {format as utilFormat} from "util";
import type {Palette, Mixed, ColorName, ModifierColorName} from "./types";

const regColor = /{([a-zA-Z.]+) (.+?)}/g;

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

const setMx = (name: ModifierColorName, index: number) => {
	set(name, 30 + index);
	set("bg" + name[0].toUpperCase() + name.slice(1) as ModifierColorName, 40 + index);
	set("bg" + name[0].toUpperCase() + name.slice(1) + "Bright" as ModifierColorName, 100 + index);
};

const clr1: ColorName[] = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "gray"];
const clr2: ColorName[] = ["darkGray", "lightRed", "lightGreen", "lightYellow", "lightBlue", "lightMagenta", "lightCyan", "white"];

clr1.forEach((name, index) => {
	setMx(name, index);
	if(name === "gray") {
		setMx("grey", index);
	}
});

clr2.forEach((name, index) => {
	set(name, 90 + index);
	if(name === "darkGray") {
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
	for(const name of list) {
		prefix += colors[name];
	}
	return prefix + text + colorReset;
}

function colorRs(full: string, a: string, b: string) {
	let n = 0;
	let text = "";
	const repeat: string[] = [];
	a.split(".").forEach(name => {
		if(isModifierColorName(name) && !repeat.includes(name)) {
			n ++;
			text += colors[name];
			repeat.push(name);
		}
	});
	if(n < 1) {
		return full;
	}
	if(!process.stdout.isTTY) {
		return b;
	}
	return text.concat(b).concat(colorReset);
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

export const mixed: Mixed = createProxy<Mixed>();

export const color: Palette = function color(name: string, text: string) {
	return isModifierColorName(name) ? (colors[name] + text + colorReset) : text;
} as Palette;

(Object.keys(colors) as ModifierColorName[]).forEach((name) => {
	Object.defineProperty(color, name, {
		value(text: string) {
			return colors[name] + text + colorReset;
		}
	});
});

export function newError(message: string, ... args: (string | number)[] | [(string | number)[]]): Error {
	return new Error( format(message, ... args) );
}

// ex. format("text {red text}")
// ex. format("text {bgWhite.red.bold %s}", ["text"]);

export function format(message: string, ... args: any[]) {
	message = message.replace(regColor, colorRs);
	if(args.length) {
		if(args.length === 1 && Array.isArray(args[0])) {
			args = args[0];
		}
		message = utilFormat(message, ... args);
	}
	return message;
}

export type {ModifierColorName, ModifierName, ColorName, Mixed, Palette} from "./types";