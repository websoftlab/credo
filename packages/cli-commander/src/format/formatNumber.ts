import type {FormatFunction} from "./types";
import getValue from "./getValue";
import getError from "./getError";
import {formats} from "../constants";

export const formatNumber: FormatFunction<number, boolean> = function formatNumber(stringValue, isInt = true) {
	const value = isInt ? parseInt(stringValue) : parseFloat(stringValue);
	if(isNaN(value) || !isFinite(value)) {
		return getError(formats.invalidNumber);
	}
	return getValue(value);
}