import type { ArgumentOptions, CommandOptions, ErrorOptionOptions, OptionOptions } from "./types";
import Argument from "./Argument";
import Option from "./Option";
import ErrorOption from "./ErrorOption";
import { newError, color } from "@credo-js/cli-color";
import { getOptions, isOptionName } from "./util";
import util from "util";
import { args, commands, opts } from "./constants";

function option(name: string, optionList: (Option | ErrorOption)[]) {
	if (optionList.findIndex((opt) => opt.name === name) !== -1) {
		throw newError(opts.duplicate, name);
	}
}

export default class Command {
	private _argument: Argument | null = null;
	private _optionList: (Option | ErrorOption)[] = [];
	private _handler?: Function = undefined;
	private _option: Required<CommandOptions>;

	constructor(public name: string, options: CommandOptions = {}) {
		let { notation = true } = options;
		if (notation === "") {
			notation = false;
		}
		this._option = {
			notation,
			description: options.description || "",
			strict: options.strict === true,
			version: options.version || "",
			stream: options.stream || process.stdout,
		};
	}

	get commandArgument() {
		return this._argument;
	}

	get commandOptionList() {
		return this._optionList.filter((option) => !(option instanceof ErrorOption || option.hidden)) as Option[];
	}

	get commandNotation() {
		return this._option.notation;
	}

	get commandDescription() {
		return this._option.description;
	}

	get commandStrict() {
		return this._option.strict;
	}

	get commandVersion() {
		return this._option.version;
	}

	stream(value: NodeJS.WriteStream) {
		this._option.stream = value;
		return this;
	}

	version(version: string) {
		this._option.version = version || "";
		return this;
	}

	notation(notation: string | boolean) {
		if (typeof notation === "string") {
			notation = notation.trim();
			if (notation === "") {
				notation = false;
			}
		} else {
			notation = Boolean(notation);
		}
		this._option.notation = notation;
		return this;
	}

	description(description: string) {
		this._option.description = description || "";
		return this;
	}

	argument(options: ArgumentOptions | string) {
		if (this._argument) {
			throw new Error(args.duplicate);
		}
		this._argument = new Argument(getOptions(options, "description"));
		return this;
	}

	option(name: string, options: OptionOptions | string = {}) {
		option(name, this._optionList);
		this._optionList.push(new Option(name, getOptions(options, "description")));
		return this;
	}

	error(name: string, options: ErrorOptionOptions | string = {}) {
		option(name, this._optionList);
		options = getOptions(options, "message");
		if (options.stream == null) {
			options.stream = this._option.stream;
		}
		this._optionList.push(new ErrorOption(name, options));
		return this;
	}

	strict(value: boolean = true) {
		this._option.strict = Boolean(value);
		return this;
	}

	action<Args = any, Params = any, Result = number>(
		handler: (args: Args, parameters: Params, stream: NodeJS.WriteStream) => Result | Promise<Result>
	) {
		if (this._handler) {
			throw new Error(commands.duplicateAction);
		}
		if (typeof handler !== "function") {
			throw new Error(commands.actionFunctionType);
		}
		this._handler = handler;
		return this;
	}

	async begin(argv: string[]) {
		if (typeof this._handler !== "function") {
			throw newError(commands.actionNotDefined, this.name);
		}

		const strict = this._option.strict;
		const findOpt = (key: string) => {
			let opt = this._optionList.find((opt) => opt.name === key);
			if (opt) {
				return opt;
			}
			for (const option of this._optionList) {
				if (option.alt.includes(key)) {
					if (opt) {
						throw newError(opts.duplicateAlt, key);
					}
					opt = option;
				}
			}
			return opt;
		};

		let key = "";
		let option: Option | ErrorOption | undefined;

		for (let arg of argv) {
			if (isOptionName(arg)) {
				key = arg;
				option = findOpt(key);
				if (option) {
					option.define();
				} else if (strict) {
					throw newError(opts.unknown, key);
				}
			} else if (option) {
				option.add(arg);
			} else if (!key) {
				if (this._argument) {
					this._argument.add(arg);
				} else if (strict) {
					throw newError(args.unknown, arg);
				}
			}
		}

		const handlerArgs = this._argument ? this._argument.val() : null;
		const parameters: any = {};

		this._optionList.forEach((option) => {
			const val = option.val();
			if (val) {
				parameters[val.name] = val.value;
			}
		});

		let notation = this._option.notation;
		if (notation === true) {
			notation = this._option.description;
		}
		if (notation) {
			this._option.stream.write(color.lightGreen("$ ") + notation + "\n");
		}

		const result: any = await this._handler(handlerArgs, parameters, this._option.stream);
		if (result == null) {
			return 0;
		}
		if (typeof result === "number") {
			return result;
		}
		if (typeof result === "boolean") {
			return result ? 0 : 1;
		}

		if (result instanceof Error) {
			throw result;
		}

		this._option.stream.write(util.format(result) + "\n");
		return 1;
	}
}
