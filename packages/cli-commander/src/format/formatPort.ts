import type {FormatFunction} from "./types";
import getError from "./getError";
import getValue from "./getValue";
import {formats} from "../constants";

export const formatPort: FormatFunction<number> = function formatPort(value: string | number) {
	if(typeof value === "string") {
		value = parseInt(value);
	}
	if(isNaN(value) || !isFinite(value) || value < 0 || value > 65535) {
		return getError(formats.invalidPort);
	}
	return getValue(value);
}