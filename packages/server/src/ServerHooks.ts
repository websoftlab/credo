import type {Server} from "./types";
import type {Evn} from "@credo-js/utils/events";
import {debug} from "@credo-js/utils/srv/index";
import {createPlainEvent, subscribe, has} from "@credo-js/utils/events";

type ListenersData = Record<Server.HookName, Evn[]>;

const LISTENER_KEY = Symbol();

function observe(evn: Evn) {
	evn.emit = async (event: any) => {
		try {
			await evn.listener.call(null, event);
		} catch(err) {
			debug.error(`The {cyan %s} hook failure`, evn.name, err);
			throw err;
		} finally {
			if(evn.once) {
				evn.unsubscribe();
			}
		}
	}
}

export default class ServerHooks implements Server.HooksInterface {

	[LISTENER_KEY]: ListenersData = {};

	subscribe<T = any>(action: Server.HookName | Server.HookName[], listener: Server.HookListener<T>): Server.HookUnsubscribe {
		return subscribe(this[LISTENER_KEY], action, listener, false, observe);
	}

	once<T = any>(action: Server.HookName | Server.HookName[], listener: Server.HookListener<T>): Server.HookUnsubscribe {
		return subscribe(this[LISTENER_KEY], action, listener, true, observe);
	}

	has(action: Server.HookName, listener?: Server.HookListener): boolean {
		return has(this[LISTENER_KEY], action, listener);
	}

	async emit<T = any>(action: Server.HookName, event?: T): Promise<void> {
		const all = this[LISTENER_KEY];
		if(all.hasOwnProperty(action)) {
			const listeners = all[action].slice();
			event = createPlainEvent(action, event);
			for(let evn of listeners) {
				await evn.emit(event);
			}
		}
	}
}