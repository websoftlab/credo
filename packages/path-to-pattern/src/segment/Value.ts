import { AbstractSegment } from "./AbstractSegment";
import type { PatternFormatter } from "../types";

export default class Value extends AbstractSegment {
	constructor(public name: string, public required: boolean, public formatter?: PatternFormatter) {
		super("value");
	}
	compare(item: string | undefined): false | { offset: number; data?: any } {
		if (item == null) {
			return this.required ? false : { offset: 0 };
		}
		let value: any = item;
		if (this.formatter) {
			const t = this.formatter(item);
			if (!t) {
				return false;
			}
			if (t !== true) {
				value = t.value;
			}
		}
		return {
			offset: 1,
			data: {
				[this.name]: value,
			},
		};
	}
	replace(data: any, encode?: (str: string) => string): string {
		const { name } = this;
		if (data.hasOwnProperty(name) && data[name] != null) {
			const value = String(data[name]);
			if (value != "") {
				return encode ? encode(value) : value;
			}
		}
		if (this.required) {
			throw new Error(`The "${this.name}" parameter is required`);
		}
		return "";
	}
}
