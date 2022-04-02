import type {CommanderOptions} from "./types";
import Command from "./Command";
import {CommandOptions} from "./types";
import {newError} from "@credo-js/cli-color";
import {helpCommand, helpCommandList} from "./help";
import {getOptions} from "./util";
import {EventEmitter} from "events";
import {commands} from "./constants";

export default class Commander extends EventEmitter {
	private _commandList: Command[] = [];
	private _option: Required<CommanderOptions>;

	constructor(options: CommanderOptions = {}) {
		super();
		const {prompt, version, description, stream} = options;
		this._option = {
			version: typeof version === "string" ? version : "1.0",
			description: typeof description === "string" ? description : "",
			prompt: typeof prompt === "string" ? prompt : "bin",
			stream: stream || process.stdout,
		};
	}

	get commands() {
		return this._commandList.slice();
	}

	get version() {
		return this._option.version;
	}
	set version(value: string) {
		this._option.version = value || "";
	}

	get prompt() {
		return this._option.prompt;
	}
	set prompt(value: string) {
		this._option.prompt = value || "";
	}

	get description() {
		return this._option.description;
	}
	set description(value: string) {
		this._option.description = value || "";
	}

	get stream() {
		return this._option.stream;
	}
	set stream(value: NodeJS.WriteStream) {
		this._option.stream = value;
	}

	add(command: Command) {
		const cmd = this._commandList.find(cmd => cmd.name === command.name);
		if(!cmd) {
			this.emit("add", command);
			this._commandList.push(command);
		} else if(cmd !== command) {
			throw newError(commands.duplicateName, cmd.name);
		}
		return this;
	}

	remove(command: Command) {
		const copyCommandList = this._commandList.slice();
		const index = copyCommandList.indexOf(command);
		if(index === -1) {
			return this;
		}
		this.emit("remove", command);
		copyCommandList.splice(index, 1);
		this._commandList = copyCommandList;
		return this;
	}

	find(name: string) {
		return this._commandList.find(cmd => cmd.name === name);
	}

	command(name: string, options: CommandOptions | string = {}) {

		options = getOptions(options, "description");

		let cmd = this.find(name);
		if(!cmd) {
			cmd = new Command(name, {
				stream: this.stream,
				... options,
			});
			this.emit("add", cmd);
			this._commandList.push(cmd);
		} else {
			typeof options.description === "string" && cmd.description(options.description);
			typeof options.version === "string" && cmd.version(options.version);
			typeof options.strict === "boolean" && cmd.strict(options.strict);
			options.stream && cmd.stream(options.stream);
		}

		return cmd;
	}

	async begin(argvInit?: string[]): Promise<number> {

		const argv = Array.isArray(argvInit) ? argvInit.slice() : process.argv.slice(2);
		const name = argv.shift();
		const command = this._commandList.find(cmd => cmd.name === name);

		if(command) {
			this.emit("begin", command);
			return command.begin(argv);
		}

		const ok = name === "--help";
		if(ok && argv[0]) {
			await helpCommand(this, argv[0]);
		} else {
			await helpCommandList(this);
		}

		return ok ? 0 : 1;
	}
}