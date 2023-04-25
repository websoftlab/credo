import type { Formatter, FormatterType, FormatterOptionType, IdType } from "./types";

const formatters: Record<string, Formatter> = {
	trim: formatterTrim,
	ltrim: formatterLTrim,
	rtrim: formatterRTrim,
	lower: formatterLower,
	upper: formatterUpper,
	escape: formatterEscape,
	unescape: formatterUnEscape,
};

const regTrim = /^\s+|\s+$/g;
const regLTrim = /^\s+/;
const regRTrim = /\s+$/;

function formatterTrim(value: string) {
	return value == null ? "" : String(value).replace(regTrim, "");
}

function formatterLTrim(value: string) {
	return value == null ? "" : String(value).replace(regLTrim, "");
}

function formatterRTrim(value: string) {
	return value == null ? "" : String(value).replace(regRTrim, "");
}

function formatterLower(value: string) {
	return value == null ? "" : String(value).toLowerCase();
}

function formatterUpper(value: string) {
	return value == null ? "" : String(value).toUpperCase();
}

const fn1 = (n: number) => n > 47 && n < 58; // number only
const fn2 = (n: number) => (n > 47 && n < 58) || (n > 96 && n < 103) || (n > 64 && n < 71); // number A-Z a-z
const fn3 = (n: number) => (n > 47 && n < 58) || (n > 96 && n < 123) || (n > 64 && n < 91) || n === 95; // number a-z A-Z _

function escapeAmp(text: string) {
	text = String(text);

	let pos = 0;
	while (pos < text.length) {
		let index = text.indexOf("&", pos);
		if (index === -1) {
			break;
		}

		let ignore = false;
		let ix = index + 1;
		let lm = 50;
		let cn = 0;
		let fn = fn3;

		if (text.charAt(ix) === "#") {
			ix++;
			lm = 10;
			fn = fn1;
			if (text.charAt(ix) === "x") {
				ix++;
				fn = fn2;
			}
		}

		while (ix < text.length) {
			const n = text.charCodeAt(ix++);
			if (n === 59) {
				if (cn > 0) {
					ignore = true;
				}
				break;
			} else if (fn(n)) {
				if (++cn === lm) {
					break;
				}
			} else {
				break;
			}
		}

		if (ignore) {
			pos = ix - 1 > index ? ix - 1 : ix;
		} else {
			text =
				(index > 0 ? text.substring(0, index) : "") +
				"&amp;" +
				(index + 1 < text.length ? text.substring(index + 1) : "");
			pos = index + 5;
		}
	}

	return text;
}

function formatterEscape(value: string) {
	if (value == null) {
		return "";
	}
	return escapeAmp(value)
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\//g, "&#x2F;")
		.replace(/\\/g, "&#x5C;")
		.replace(/`/g, "&#96;");
}

function formatterUnEscape(value: string) {
	if (value == null) {
		return "";
	}
	return String(value)
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#x2F;/g, "/")
		.replace(/&#x5C;/g, "\\")
		.replace(/&#96;/g, "`")
		.replace(/&amp;/g, "&"); // &amp; replacement has to be the last one to prevent
}

export const createInvalidArgumentsFormatter: (name: string) => Formatter = (name) => {
	let isThrow = false;
	return function validInvalidArguments(value) {
		if (!isThrow) {
			try {
				throw new Error(`Invalid arguments for "${name}" formatter entry`);
			} finally {
				isThrow = true;
			}
		}
		return value;
	};
};

function formatter(variant: string | FormatterOptionType): Formatter {
	let name: string = "",
		option: any = null;
	if (typeof variant === "string") {
		name = variant;
	} else if (variant && variant.name) {
		name = String(variant.name);
		if (variant.option && Object.keys(variant.option).length !== 0) {
			option = { ...variant.option };
		}
	}
	name = name.toLowerCase();
	if (formatters.hasOwnProperty(name)) {
		const formatter = formatters[name];
		if (option != null) {
			return (value, name) => {
				return formatter(value, name, option);
			};
		}
		return formatter;
	}
	return createInvalidArgumentsFormatter(name);
}

function createFormatterOne(formatterType: FormatterType) {
	return typeof formatterType === "function" ? formatterType : formatter(formatterType);
}

export function defineFormatter(name: string, callback: Formatter) {
	if (typeof callback === "function") {
		formatters[name] = callback;
	}
}

export function createFormatter<Val = any>(format: FormatterType | FormatterType[]): Formatter<Val> {
	if (Array.isArray(format)) {
		const variant: Formatter[] = format.map((format) => createFormatterOne(format));
		if (variant.length === 0) {
			return (value: Val) => value;
		}
		if (variant.length === 1) {
			return variant[0];
		}
		return (value: Val, id: IdType) => {
			return variant.reduce((prev, formatter) => formatter(prev, id), value);
		};
	} else {
		return createFormatterOne(format);
	}
}
