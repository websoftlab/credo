import type { PhragonJSGlobal } from "../types";
import type { Commander } from "@phragon/cli-commander";
import type { Command } from "@phragon/cli-commander";

export interface PhragonJSCmd extends PhragonJSGlobal {
	readonly mode: "cmd";
	readonly cmd: Commander;
}

export interface OnBuildHook {}

export type CommanderCtor<Opt = never> = (phragon: PhragonJSCmd, command: Command, opt?: Opt) => void;
