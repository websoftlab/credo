export interface Debugger {
	(formatter: any, ...args: any[]): void;
	[key: string]: DebugLogger;
}

export type DebugLogger = (formatter: any, ...args: any[]) => void;

export type DebugListener = (event: DebugEvent) => void | Promise<void>;

export interface DebugEvent {
	namespace: string;
	timestamp: number;
	[key: string]: any;
}
