import type { OptionOptions, MinOptionInterface, ValType } from "./types";
import CommandProperty from "./CommandProperty";
import { newError, format } from "@credo-js/cli-color";
import { assertOptionName, getAltNames } from "./util";
import { opts } from "./constants";

export default class Option extends CommandProperty implements MinOptionInterface {
	is: boolean = false;
	keyName: string;
	isFlag: boolean = false;
	isSingleValue: boolean = false;
	hidden: boolean = false;
	alt: string[] = [];

	constructor(public name: string, options: OptionOptions = {}) {
		super(options, "value");
		assertOptionName(name);

		let { type = ["flag"], keyName, hidden, alt } = options;

		if (!Array.isArray(type)) {
			type = [type || "flag"];
		}
		if (!type.length) {
			type.push("flag");
		}

		for (const t of type) {
			switch (t) {
				case "flag":
					this.isFlag = true;
					break;
				case "multiple":
					this.multiple = true;
					break;
				case "value":
					this.isSingleValue = true;
					break;
				default:
					throw newError(opts.invalidType, t);
			}
		}

		if (this.multiple && this.isSingleValue) {
			throw newError(opts.valueTypeConflict);
		}

		if (this.isFlag) {
			this.required = false;
		}

		this.keyName = keyName || name.replace(/^-+/, "").replace(/-[a-z]/g, (m) => m[1].toUpperCase());

		if (hidden) {
			this.hidden = true;
		}

		this.alt = getAltNames(name, alt);
	}

	val<T = any>(): null | ValType<T> {
		const error = this._error();
		if (error) {
			throw new Error(error.error);
		}
		const { value, keyName } = this;
		function val(value: any) {
			return {
				name: keyName,
				value,
			};
		}
		if (value.length === 0) {
			if (this.isFlag) {
				return val(this.is);
			}
			if (this.is && this.multiple) {
				return val([]);
			}
			return null;
		}
		if (value.length === 1 && !this.multiple) {
			return val(value[0]);
		}
		return val(value.slice());
	}

	add(value: string) {
		if (this.multiple || this.isSingleValue) {
			super.add(value);
		} else {
			throw newError(opts.flagOnly, this.name);
		}
	}

	define() {
		this.is = true;
	}

	protected _error(): false | { error: string } {
		if (this.value.length === 0) {
			if (this.isFlag) {
				return false;
			}
			if (this.is) {
				if (this.multiple) {
					return super._error();
				}
				return {
					error: format(this.message || opts.valuable, this.name),
				};
			}
			if (this.required) {
				return {
					error: format(this.message || opts.required, this.name),
				};
			}
			return false;
		}
		if (this.multiple || this.isSingleValue) {
			return super._error();
		} else {
			return {
				error: format(opts.invalidValue, this.name),
			};
		}
	}
}
