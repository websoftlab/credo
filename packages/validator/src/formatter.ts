import type { Formatter, FormatterType, IdType } from "./types";

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

function formatterEscape(value: string) {
	if (value == null) {
		return "";
	}
	return String(value)
		.replace(/&(?!#?\w+;)/g, "&amp;")
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

export const formatterInvalidArguments: Formatter = function validInvalidArguments() {
	throw new Error("Invalid arguments for formatter entry");
};

function formatter(variant: string): Formatter {
	variant = variant.toLowerCase();
	if (formatters.hasOwnProperty(variant)) {
		return formatters[variant];
	}
	return formatterInvalidArguments;
}

function createFormatterOne(formatterType: FormatterType) {
	return typeof formatterType === "function" ? formatterType : formatter(formatterType);
}

export function defineFormatter(name: string, callback: Formatter) {
	if (typeof callback === "function") {
		formatters[name] = callback;
	}
}

export function createFormatter(format: FormatterType | FormatterType[]): Formatter {
	if (Array.isArray(format)) {
		const variant: Formatter[] = format.map((format) => createFormatterOne(format));
		if (variant.length === 0) {
			return (value: string) => value;
		}
		if (variant.length === 1) {
			return variant[0];
		}
		return (value: string, id: IdType) => {
			return variant.reduce((prev, formatter) => formatter(prev, id), value);
		};
	} else {
		return createFormatterOne(format);
	}
}
