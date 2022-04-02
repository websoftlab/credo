import createDebug from "debug";
import util from "util";
import {getLogger, createWinstonLogger} from "./winstonLogger";
import {reconfigure} from "./accessibility";
import createLogger from "./createLogger";
import {addListener, emitListener, listenersLength, removeListener} from "./listeners";
import {setFormat} from "./formatters";
import type {DebugListener, Debugger} from "./types";
import {setPrefix, getPrefix} from "./namespace";

const app = createLogger(`app`);
const formatArgsOrigin = createDebug.formatArgs;

createDebug.formatArgs = function formatArgs(originArgs) {
	const {namespace} = this;
	const args = originArgs.slice();

	formatArgsOrigin.call(this, originArgs);

	// emit event
	if(listenersLength() === 0) {
		return;
	}

	const evn: { namespace: string } & Record<string, any> = {namespace};
	if(typeof args[0] === "string") {
		evn.message = args.shift();
		if(args.length) {
			evn.message = util.format(evn.namespace, ... args);
		}
	} else {
		evn.args = args;
	}

	emitListener(evn);
}

const log = createLogger("app") as Debugger;
log.app = app;

export const debug: Debugger = new Proxy<Debugger>(log, {
	get(target, name: string) {
		if(name in target) {
			return target[name];
		}
		const func = createLogger(name);
		target[name] = func;
		return func;
	}
});

export function debugSubscribe(handler: DebugListener) {
	if(typeof handler !== "function") {
		return () => {};
	}
	addListener(handler);
	return () => {
		removeListener(handler);
	}
}

export function debugEnable(namespaces: string = "*") {

	if(!namespaces) {
		namespaces = process.env.DEBUG || "";
		if(!namespaces) {
			const prefix = getPrefix();
			if(!prefix) {
				return;
			}
			namespaces = `${prefix}*`;
		}
	}

	// native debug
	createDebug.enable(namespaces);

	// system
	reconfigure(namespaces);
}

export function debugFormat<T = any, F = any, D = any>(namespace: string, formatter: (object: T) => F, details?: D) {
	if(typeof formatter !== "function") {
		throw new Error("Log formatter must be a function");
	}
	setFormat(namespace, formatter, details);
}

export function debugSetNamespacePrefix(prefix: string) {
	setPrefix(prefix);
}

export function debugConfig(options: any) {
	const {
		namespacePrefix,
		... rest
	} = options;
	createWinstonLogger(rest);
	if(typeof namespacePrefix === "string") {
		setPrefix(namespacePrefix);
	}
}

export function winston() {
	return getLogger();
}

export type {Debugger, DebugEvent, DebugListener, DebugLogger} from "./types";