import {AbstractSegment} from "./AbstractSegment";
import type {PatternFormatter} from "../types";

export type SegmentValue = {
	prefix: string,
	suffix: string,
	name: string,
	required: boolean,
	format?: PatternFormatter,
}

export default class Values extends AbstractSegment {
	constructor(public pattern: RegExp, public values: Array<string | SegmentValue>) {
		super("values");
	}

	private _empty() {
		for(let value of this.values) {
			if(typeof value === "string" || value.required) {
				return false;
			}
		}
		return {offset: 0};
	}

	compare(item: string | undefined): false | { offset: number; data?: any } {
		if(item == null) {
			return this._empty();
		}
		const match = item.match(this.pattern);
		if(!match) {
			return this._empty();
		}
		const data: any = {};
		for(let i = 0, n = 1; i < this.values.length; i++) {
			const val = this.values[i];
			if(typeof val === "string") {
				continue;
			}
			const {name, required, format} = val;
			let value: any = match[n ++];
			if(value != null) {
				if(format) {
					const frm = format(value);
					if(frm) {
						if(frm !== true) {
							value = frm.value;
						}
					} else if(required) {
						return false;
					} else {
						return this._empty();
					}
				}
				data[name] = value;
			} else if(required) {
				return false;
			}
		}
		return { offset: 1, data };
	}

	replace(data: any, encode?: ((str: string) => string)): string {
		let result = "";
		for(let value of this.values) {
			if(typeof value === "string") {
				result += value;
			} else {
				const {name} = value;
				let val = data.hasOwnProperty(name) && data[name] != null ? String(data[name]) : "";
				if(val) {
					if(encode) {
						val = encode(val);
					}
					result += value.prefix + val + value.suffix;
				} else if(value.required) {
					throw new Error(`The "${name}" parameter is required`);
				}
			}
		}
		return result;
	}
}