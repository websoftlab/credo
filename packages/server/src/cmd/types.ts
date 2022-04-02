import type {CredoJSGlobal} from "../types";
import type {Commander} from "@credo-js/cli-commander";
import type {Command} from "@credo-js/cli-commander";

export interface CredoJSCmd extends CredoJSGlobal {
	readonly mode: "cmd";
	readonly cmd: Commander;
}

export interface OnBuildHook {}

export type CommanderCtor<Opt = never> = (credo: CredoJSCmd, command: Command, opt?: Opt) => void;
