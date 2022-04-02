import type {FormatFunction} from "./types";
import getError from "./getError";
import getValue from "./getValue";
import {formats} from "../constants";

const timeNotDReg = /[^0-9]/;
const timeReg = /^([\d.]+)(ms|mn|[smhdwy])$/;
const timeMt: Record<string, number> = {
	"ms": 1,
	"s":  1000,
	"m":  60 * 1000,
	"h":  60 * 60 * 1000,
	"d":  24 * 60 * 60 * 1000,
	"w":  7   * 24 * 60 * 60 * 1000,
	"mn": 30  * 24 * 60 * 60 * 1000,
	"y":  365 * 24 * 60 * 60 * 1000,
};

function error() {
	return getError(formats.invalidTime);
}

export const formatTimeInterval: FormatFunction<number> = function formatTimeInterval(value: string) {
	value = String(value || "").trim();
	if(!value.length) {
		return error();
	}

	let interval = 0;

	if(!timeNotDReg.test(value)) {
		interval = parseInt(value);
	} else {
		const add: string[] = [];
		const split = value.replace(/(?<=[a-z])(\d)/g, ' $1').split(/\s+/g);
		for(let item of split) {
			const mt = item.match(timeReg);
			if(!mt) {
				return error();
			}
			const [, number, type] = mt;
			if(add.includes(type)) {
				return error();
			}
			add.push(type);
			interval += timeMt[type] * parseFloat(number);
		}
	}

	if(isNaN(interval) || !isFinite(interval)) {
		return error();
	}

	return getValue(interval >> 0);
}