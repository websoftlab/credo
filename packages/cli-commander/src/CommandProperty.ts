import type {Property} from "./types";
import {createFormat} from "./format";
import {newError, format} from "@credo-js/cli-color";
import {opts, args} from "./constants";

function isName(object: any): object is {name: string} {
	return typeof object.name === "string";
}

export default abstract class CommandProperty {

	propertyName: string;
	description: string;
	required: boolean;
	format: (value: string, index: number) => any;
	min: number;
	max: number;
	multiple: boolean = false;
	value: any[] = [];
	unique: boolean;

	protected constructor(options: Property, propertyName: string) {

		const {
			name,
			format,
			required,
			description = "",
			message,
			min = 0,
			max = 0,
			set = [],
			unique,
		} = options;

		this.propertyName = name || propertyName;
		this.format = createFormat({
			name: isName(this) ? this.name : "",
			format,
			set,
			message,
		});
		this.required = required === true;
		this.description = description;
		this.min = min > 0 ? min : 0;
		this.max = max > 0 ? max : 0;
		this.unique = unique === true;
	}

	add(value: string) {
		if(!this.multiple && this.value.length) {
			throw isName(this)
				? newError(opts.onlyOne, this.name)
				: newError(args.onlyOne);
		}
		if(this.max !== 0 && this.value.length >= this.max) {
			throw isName(this)
				? newError(opts.tooMany, this.name)
				: newError(args.tooMany);
		}
		const val = this.format(value, this.value.length);
		if(this.unique && this.value.includes(val)) {
			return;
		}
		this.value.push(val);
	}

	protected _error(): false | {error: string} {
		const {value} = this;
		if(this.multiple) {
			if(this.min > 0 && value.length < this.min) {
				return {
					error: isName(this)
						? format(opts.notEnough, this.name)
						: format(args.notEnough)
				};
			}
			if(this.required && value.length === 0) {
				return {
					error: isName(this)
						? format(opts.required, this.name)
						: format(args.required)
				};
			}
			return false;
		}
		if(this.required && value.length !== 1) {
			return {
				error: isName(this)
					? format(opts.required, this.name)
					: format(args.required)
			};
		}
		return false;
	}

	info() {
		return {
			propertyName: this.propertyName,
			description: this.description,
			required: this.required || this.multiple && this.min > 0,
			multiple: this.multiple,
		};
	}
}