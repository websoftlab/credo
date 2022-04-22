import type { CommanderOptions } from "./types";
import type Command from "./Command";
import Commander from "./Commander";
import { CommandOptions } from "./types";

export default function createCommander(options: CommanderOptions | string = {}) {
	if (typeof options === "string") {
		options = {
			description: options,
		};
	}

	const cmd = new Commander(options);

	function commander(name: string, options?: CommandOptions | string) {
		return cmd.command(name, options);
	}

	function defineValue<T>(name: string, value: T) {
		Object.defineProperty(commander, name, {
			value,
			enumerable: true,
			configurable: false,
			writable: false,
		});
	}

	function defineSetGet<T>(name: string, get: () => T, set?: (value: T) => void) {
		Object.defineProperty(commander, name, {
			get,
			set,
			enumerable: true,
			configurable: false,
		});
	}

	defineValue("commander", cmd);
	defineValue("add", cmd.add.bind(cmd));
	defineValue("remove", cmd.remove.bind(cmd));
	defineValue("find", cmd.find.bind(cmd));
	defineValue("begin", cmd.begin.bind(cmd));

	defineSetGet(
		"version",
		() => cmd.version,
		(value) => {
			cmd.version = value;
		}
	);
	defineSetGet(
		"stream",
		() => cmd.stream,
		(value) => {
			cmd.stream = value;
		}
	);
	defineSetGet(
		"prompt",
		() => cmd.prompt,
		(value) => {
			cmd.prompt = value;
		}
	);
	defineSetGet(
		"description",
		() => cmd.description,
		(value) => {
			cmd.description = value;
		}
	);
	defineSetGet("commands", () => cmd.commands);

	return commander as Omit<Commander, "command"> & {
		(name: string, options?: CommandOptions | string): Command;
		readonly commander: Commander;
	};
}
