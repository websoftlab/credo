import type {Debugger as DebuggerCtor} from "debug";

export interface Debugger {
	(formatter: any, ...args: any[]): void;
	[key: string]: DebuggerCtor;
}

export type DebugListener = (event: DebugEvent) => (void | Promise<void>);

export interface DebugEvent {
	timestamp: number;
	name: string;
	args: any[];
}
