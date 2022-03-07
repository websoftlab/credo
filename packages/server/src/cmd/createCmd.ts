import type {Cmd, CredoJSCmd} from "./types";

function read(name: string, initArgs: string[]) {

	let pos = name.indexOf(":");
	let subName: string | undefined = undefined;
	if(pos !== -1) {
		subName = name.substring(pos + 1);
		name = name.substring(0, pos);
		if(subName.length < 1) {
			throw new Error("Additional command name is empty")
		}
	}

	const args: string[] = [];
	const options: Record<string, boolean | string | string[]> = {};

	let prev: string | null = null;
	for(let i = 2; i < initArgs.length; i++) {
		const val = initArgs[i];
		if(val.startsWith("-")) {
			if(!options.hasOwnProperty(val)) {
				options[val] = true;
			}
			prev = val;
		} else if(prev) {
			const last = options[prev];
			if(last === true) {
				options[prev] = val;
			} else if(Array.isArray(last)) {
				last.push(val);
			} else {
				options[prev] = [last as string, val];
			}
		} else {
			args.push(val);
		}
	}

	return {
		name,
		subName,
		args,
		options,
	};
}

export default function createCmd(credo: CredoJSCmd, originName: string, initArgs: string[]): Cmd {

	const {name, subName, args, options} = read(originName, initArgs);
	const commands: Record<string, Cmd.Commander> = {};
	const has = (name: string) => commands.hasOwnProperty(name);
	let isRun = false;

	const cmd: Cmd = {
		get name() {
			return originName;
		},
		get args(): string[] {
			return args.slice();
		},
		get length(): number {
			return args.length;
		},
		get options(): string[] {
			return Object.keys(options);
		},
		option(name: string): boolean | string | string[] {
			const value = options.hasOwnProperty(name) ? options[name] : false;
			return Array.isArray(value) ? value.slice() : value;
		},
		argument(index: number): string | undefined {
			return args[index];
		},
		has,
		async register(name: string, ctor: Cmd.CommanderCtor): Promise<void> {
			if(has(name)) {
				throw new Error(`Command \`${name}\` already registered`);
			}
			if(typeof ctor !== "function") {
				throw new Error(`Cmd.CommanderCtor must be a function`);
			}
			const commander = await ctor(credo);
			if(commander != null && (typeof commander === "function" || typeof commander === "object")) {
				commands[name] = commander;
			} else {
				throw new Error(`Cmd.Commander must be a function or an object`);
			}
		},
		async run(): Promise<void> {
			if(isRun) {
				throw new Error("Command line is already running");
			}

			if(!has(name)) {
				throw new Error(`Command \`${name}\` not registered`);
			}

			const com = commands[name];

			isRun = true;
			try {
				if(typeof com === "function") {
					await com(subName);
				} else {
					const key = subName == null ? "default" : subName;
					if(com.hasOwnProperty(key)) {
						await com[key](subName);
					} else {
						throw new Error(`Command \`${name}:${key}\` not registered`);
					}
				}
			} finally {
				isRun = false;
			}
		}
	};

	Object.freeze(cmd);
	return cmd;
}