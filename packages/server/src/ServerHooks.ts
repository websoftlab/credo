import type { Server } from "./types";
import type { Evn, ListenersData } from "@phragon-util/event-map";
import { debug } from "@phragon/cli-debug";
import { createPlainEvent, subscribe, has } from "@phragon-util/event-map";

const LISTENER_KEY = Symbol();

function observe(evn: Evn) {
	evn.emit = async (event: any) => {
		try {
			await evn.listener.call(null, event);
		} catch (err) {
			debug.error(`The {cyan %s} hook failure`, evn.name, err);
			throw err;
		} finally {
			if (evn.once) {
				evn.unsubscribe();
			}
		}
	};
}

export default class ServerHooks implements Server.HooksInterface {
	[LISTENER_KEY]: ListenersData = new Map<Server.HookName, Set<Evn>>();

	subscribe<T = any>(
		action: Server.HookName | Server.HookName[],
		listener: Server.HookListener<T>
	): Server.HookUnsubscribe {
		return subscribe(this[LISTENER_KEY], action, listener, false, observe);
	}

	once<T = any>(
		action: Server.HookName | Server.HookName[],
		listener: Server.HookListener<T>
	): Server.HookUnsubscribe {
		return subscribe(this[LISTENER_KEY], action, listener, true, observe);
	}

	has(action: Server.HookName, listener?: Server.HookListener): boolean {
		return has(this[LISTENER_KEY], action, listener);
	}

	async emit<T = any>(action: Server.HookName, event?: T): Promise<void> {
		const map = this[LISTENER_KEY].get(action);
		if (map && map.size) {
			event = createPlainEvent(action, event);
			for (let evn of map.values()) {
				await evn.emit(event);
			}
		}
	}
}
