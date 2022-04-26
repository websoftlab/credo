import { makeUrl } from "@phragon/make-url";
import { createPlainEvent, subscribe, has } from "@phragon/utils/events";
import type { API, App, Page } from "./types";
import type { URL, OnMakeURLHook } from "@phragon/make-url";
import type { Evn } from "@phragon/utils/events";

type ListenersData = Record<API.HookName, Evn[]>;

function observe(evn: Evn) {
	evn.emit = (self: any, event: any) => {
		try {
			evn.listener.call(self, event);
		} catch (err) {
			console.log(`The ${evn.name} hook error`, err);
		} finally {
			if (evn.once) {
				evn.unsubscribe();
			}
		}
	};
}

export default class Api<ComponentType, Store = any> implements API.ApiInterface<ComponentType> {
	title: string = "";
	ssr: boolean = false;
	baseUrl: string = "/";
	services: API.Services;

	private _listeners: ListenersData = {};

	constructor(
		public mode: "client" | "server",
		public app: App.StoreInterface<Store>,
		public page: Page.StoreInterface<ComponentType>
	) {
		this.services = {
			translator: app.translator,
			http: page.http,
		};
	}

	makeUrl: URL.Handler = (url): string => {
		if (typeof url === "string" || Array.isArray(url)) {
			url = { path: url };
		}
		const { details = {}, ...opts } = url;
		const event = { url: opts, details };
		this.emit<OnMakeURLHook>("onMakeURL", event);
		return makeUrl(event.url);
	};

	has(action: API.HookName, listener?: API.HookListener): boolean {
		return has(this._listeners, action, listener);
	}

	subscribe<T = any>(action: API.HookName | API.HookName[], listener: API.HookListener<T>): API.HookUnsubscribe {
		return subscribe(this._listeners, action, listener, false, observe);
	}

	once<T = any>(action: API.HookName | API.HookName[], listener: API.HookListener<T>): API.HookUnsubscribe {
		return subscribe(this._listeners, action, listener, true, observe);
	}

	emit<T = any>(action: API.HookName, event?: T) {
		if (this._listeners.hasOwnProperty(action)) {
			event = createPlainEvent(action, event);
			this._listeners[action].slice().forEach((evn: Evn) => {
				evn.emit(this, event);
			});
		}
	}
}
