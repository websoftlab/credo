import util from "util";
import type {ColorName, ModifierColorName} from "./types";

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

function colorRs(full: string, a: string, b: string) {
	let n = 0;
	let text = "";
	const repeat: string[] = [];
	a.split(".").forEach(color => {
		if(isModifierColorName(color) && !repeat.includes(color)) {
			n ++;
			text += colors[color];
			repeat.push(color);
		}
	});
	if(n < 1) {
		return full;
	}
	if(!process.stdout.isTTY) {
		return b;
	}
	return text + b + colorReset;
}

export function newError(message: string, ... args: (string | number)[] | [(string | number)[]]): Error {
	return new Error( format(message, ... args) );
}

// ex. color("text {red text}")
// ex. color("text {bgWhite.red.bold %s}", ["text"]);

export function format(message: string, ... args: any[]) {
	message = message.replace(regColor, colorRs);
	if(args.length) {
		if(args.length === 1 && Array.isArray(args[0])) {
			args = args[0];
		}
		message = util.format(message, ...args);
	}
	return message;
}
