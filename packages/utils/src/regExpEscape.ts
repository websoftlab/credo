const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);

function format(value: string) {
	return value == null ? "" : String(value);
}

export function regExpEscape(str: string): string {
	str = format(str);
	if (str.length === 0) {
		return "";
	}
	return reHasRegExpChar.test(str) ? str.replace(reRegExpChar, "\\$&") : str;
}

export function regExpEscapeSet(str: string, negative: boolean = false): string {
	str = format(str);
	if (str.length === 0) {
		throw new Error("At least one character must be used for grouping");
	}
	return (negative ? "[^" : "[") + regExpEscapeInSet(str, !negative) + "]";
}

export function regExpEscapeInSet(str: string, first: boolean = true) {
	str = format(str);
	if (str.length === 0) {
		return "";
	}
	let group = "";
	let escaped = "";
	for (let i = 0; i < str.length; i++) {
		let char = str[i];
		if (group.includes(char)) {
			continue;
		}
		group += char;
		if ((first && char === "^" && escaped.length === 0) || char === "-" || char === "\\" || char === "]") {
			char = "\\" + char;
		}
		escaped += char;
	}
	return escaped;
}
