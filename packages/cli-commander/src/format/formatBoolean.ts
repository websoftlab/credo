import type {FormatFunction} from "./types";
import getValue from "./getValue";
import getError from "./getError";
import {formats} from "../constants";

const isYes = ["y", "yes", "1", "on", "true"];
const isNot = ["n", "no", "0", "off", "false"];

export const formatBoolean: FormatFunction<boolean> = function formatBoolean(value: string) {
	value = value.toLowerCase();
	if(isYes.includes(value)) {
		return getValue(true);
	}
	if(isNot.includes(value)) {
		return getValue(false);
	}
	return getError(formats.invalidBoolean);
}