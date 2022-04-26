import type { DebugEvent } from "./types";
import asyncResult from "@phragon/utils/asyncResult";
import { DebugListener } from "./types";

const listeners: DebugListener[] = [];

async function emitAsync(event: DebugEvent) {
	for (let listener of listeners) {
		await asyncResult(listener(event));
	}
}

export function listenersLength() {
	return listeners.length;
}

export function addListener(handler: DebugListener) {
	if (!listeners.includes(handler)) {
		listeners.push(handler);
	}
}

export function removeListener(handler: DebugListener) {
	const index = listeners.indexOf(handler);
	if (index !== -1) {
		listeners.splice(index, 1);
	}
}

export function emitListener(event: { namespace: string } & Record<string, any>) {
	if (!listeners.length) {
		return;
	}
	const evn: DebugEvent = {
		...event,
		timestamp: Date.now(),
	};
	emitAsync(evn).catch((err: Error) => {
		console.error("Debug failure!", err.stack || err.message);
	});
}
