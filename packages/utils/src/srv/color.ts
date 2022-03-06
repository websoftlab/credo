const colorReset = "\x1b[0m";
const colors: Record<string, string> = {
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

["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"].forEach((color, index) => {
	colors[color] = sgr(30 + index);
	colors["bg" + color[0].toUpperCase() + color.slice(1)] = sgr(40 + index);
	colors["bg" + color[0].toUpperCase() + color.slice(1) + "Bright"] = sgr(100 + index);
});

const regColor = /{([a-zA-Z.]+) (.+?)}/g;
const regVar = /%s/g;

function colorRs(full: string, a: string, b: string) {
	let n = 0;
	let text = "";
	const repeat: string[] = [];
	a.split(".").forEach(color => {
		if(colors[color] && !repeat.includes(color)) {
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

export {colors};

export function newError(message: string, ... args: (string | number)[] | [(string | number)[]]) {
	return new Error( color(message, ... args) );
}

// ex. color("text {red text}")
// ex. color("text {bgWhite.red.bold %s}", ["text"]);
export function color(message: string, ... args: (string | number)[] | [(string | number)[]]) {
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