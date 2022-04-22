import type { FormatType } from "../types";
import { formatNumber } from "./formatNumber";
import { formatBoolean } from "./formatBoolean";
import { formatPort } from "./formatPort";
import { formatTimeInterval } from "./formatTimeInterval";
import { formatRegExp } from "./formatRegExp";
import getError from "./getError";
import { FormatFunction } from "./types";
import { newError } from "@credo-js/cli-color";
import { formats } from "../constants";

const getFormatType: FormatFunction<any, FormatType> = function formatType(value, type) {
	if (type instanceof RegExp) {
		return formatRegExp(value);
	}

	switch (type) {
		case "int":
		case "float":
			return formatNumber(value, type === "int");
		case "boolean":
			return formatBoolean(value);
		case "port":
			return formatPort(value);
		case "time-interval":
			return formatTimeInterval(value);
	}

	return getError(formats.invalidType.toLowerCase());
};

function createError(text: string, name: string, index: number, value?: string) {
	if (name) {
		const color = value ? "red" : "yellow";
		if (!value) {
			value = "... n";
		}
		const message = formats.optionError.replace("{color}", color);
		return newError(message, name, value, index, text);
	}
	if (value) {
		return newError(formats.argumentError, value, index, text);
	}
	return newError(formats.emptyError, index, text);
}

function formatType(name: string, type: FormatType, value: any, index: number, message?: string) {
	const format = getFormatType(value, type);
	if (format.valid) {
		return format.value;
	}
	if (message) {
		throw newError(message);
	}
	throw createError(format.error, name, index);
}

function isFormatType(name: string | RegExp) {
	if (!name) {
		return false;
	}
	if (name instanceof RegExp) {
		return true;
	}
	return ["int", "float", "boolean", "port", "time-interval"].includes(name);
}

function assertFormatType(name: string | RegExp) {
	if (!isFormatType(name)) {
		throw new Error(formats.invalidType);
	}
}

export function createFormat(options: { name: string; format?: FormatType; set?: string[]; message?: string }) {
	const { name, format, set, message } = options;

	if (typeof format === "function") {
		return format;
	}

	if (Array.isArray(format)) {
		format.forEach(assertFormatType);
		return (value: any, index: number) => {
			const type = format[index];
			return type ? formatType(name, type, value, index, message) : value;
		};
	}

	if (typeof format === "string") {
		assertFormatType(format);
		return (value: any, index: number) => {
			return formatType(name, format, value, index, message);
		};
	}

	if (set && set.length > 0) {
		return (value: any, index: number) => {
			if (set.includes(value)) {
				return value;
			}
			if (message) {
				throw newError(message);
			}
			if (!value) {
				throw createError(formats.empty, name, index);
			}
			throw createError(formats.invalid, name, index, value);
		};
	}

	return (value: any) => value;
}
