import type {CredoJSGlobal} from "../types";

export interface CredoJSCmd extends CredoJSGlobal {
	readonly mode: "cmd";
	readonly cmd: Cmd;
}

export interface OnBuildHook {}

export interface Cmd {
	readonly name: string;
	readonly args: string[];
	readonly options: string[];
	readonly length: number;
	option(name: string): boolean | string | string[];
	argument(index: number): string | undefined;
	has(name: string): boolean;
	register(name: string, ctor: Cmd.CommanderCtor, options?: any): Promise<void>;
	run(): Promise<void>;
}

export namespace Cmd {
	export type CommanderHandler = (name?: string) => Promise<void>;
	export type Commander = CommanderHandler | Record<string, CommanderHandler>;
	export type CommanderCtor = (credo: CredoJSCmd) => Commander;
}