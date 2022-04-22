import type { FormatFunction } from "./types";
import getError from "./getError";
import getValue from "./getValue";
import { formats } from "../constants";

export const formatRegExp: FormatFunction<RegExpMatchArray> = function formatRegExp(value: string) {
	const match = String(value).match(value);
	if (match) {
		return getValue(match);
	}
	throw getError(formats.invalid);
};
