import type {ArgumentOptions} from "./types";
import CommandProperty from "./CommandProperty";

export default class Argument extends CommandProperty {

	constructor(options: ArgumentOptions) {
		super(options, "argument-value");
		this.multiple = options.multiple === true;
	}

	val() {
		const error = this._error();
		if(error) {
			throw new Error(error.error);
		}
		const {value, multiple} = this;
		if(multiple) {
			return value.slice();
		}
		return value.length ? value[0] : null;
	}
}