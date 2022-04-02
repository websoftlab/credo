import type {ErrorOptionOptions, MinOptionInterface} from "./types";
import {format, color} from "@credo-js/cli-color";
import {assertOptionName, getAltNames} from "./util";
import {opts, titles} from "./constants";

export default class ErrorOption implements MinOptionInterface {
	alt: string[];
	throwable: boolean;
	message: string;
	stream: NodeJS.WriteStream;
	is: boolean = false;

	constructor(public name: string, options: ErrorOptionOptions = {}) {
		assertOptionName(name);
		let {alt, stream, throwable = false, message = ""} = options;
		this.alt = getAltNames(name, alt);
		this.message = message || format(opts.notAllowed, throwable ? titles.error : titles.warning, name);
		this.throwable = Boolean(throwable);
		this.stream = stream || process.stdout;
	}

	add(): void {
		this.is =  true;
	}

	define(): void {
		this.is =  true;
	}

	val(): null {
		if(!this.is) {
			return null;
		}
		if(this.throwable) {
			throw new Error(this.message);
		} else {
			this.stream.write(color.lightRed("$ ") + this.message + "\n");
		}
		return null;
	}
}