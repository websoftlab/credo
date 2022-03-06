import createDebug from "debug";
import {color} from "./color";
import asyncResult from "../asyncResult";
import type {DebugEvent, DebugListener, Debugger} from "./types";

const app = createDebug(`credo:app`);
const formatArgsOrigin = createDebug.formatArgs;
const listeners: DebugListener[] = [];

let argsPrevent = false;

async function emit(event: DebugEvent) {
	for(let listener of listeners) {
		await asyncResult(listener(event));
	}
}

createDebug.formatArgs = function formatArgs(args) {
	const {namespace} = this;
	const timestamp: number = Date.now();
	if(typeof args[0] === "string") {
		args[0] = color(args[0]);
	}
	formatArgsOrigin.call(this, args);
	if(!argsPrevent) {
		emit({
			timestamp,
			name: namespace,
			args: args.slice(),
		})
		.catch((err: Error) => {
			argsPrevent = true;
			debug.error(err);
			argsPrevent = false;
		});
	}
}

const log = function log(formatter: any, ...args: any[]) { return app(formatter, ... args); } as Debugger;
log.app = app;

const debug: Debugger = new Proxy<Debugger>(log, {
	get(target, name: string) {
		if(name in target) {
			return target[name];
		}
		const func = createDebug(`credo:${name}`);
		target[name] = func;
		return func;
	}
});

function debugSubscribe(handler: DebugListener) {
	if(typeof handler !== "function") {
		return () => {};
	}
	if(!listeners.includes(handler)) {
		listeners.push(handler);
	}
	return () => {
		const index = listeners.indexOf(handler);
		if(index !== -1) {
			listeners.splice(index, 1);
		}
	}
}

export {debug, debugSubscribe};
