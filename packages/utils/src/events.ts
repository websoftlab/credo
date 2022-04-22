import isPlainObject from "./isPlainObject";

type ListenersData = Record<string, Evn[]>;
type ListenerUnsubscribe = () => void;

export class Evn {
	name: string;
	unsubscribe: () => void;

	constructor(listeners: ListenersData, name: string, public listener: Function, public once: boolean) {
		this.name = name;
		this.unsubscribe = () => {
			if (listeners.hasOwnProperty(name)) {
				const index = listeners[name].indexOf(this);
				if (index !== -1) {
					listeners[name].splice(index, 1);
					if (listeners[name].length === 0) {
						delete listeners[name];
					}
				}
			}
			this.close();
		};
		if (!listeners.hasOwnProperty(name)) {
			listeners[name] = [];
		}
		listeners[name].push(this);
	}

	emit(..._args: any[]) {}
	close() {}
}

export function has(listeners: ListenersData, action: string, listener?: Function): boolean {
	if (!listeners.hasOwnProperty(action)) {
		return false;
	}
	if (typeof listener === "function") {
		return listeners[action].findIndex((evn) => evn.listener === listener) !== -1;
	}
	return listener == null;
}

export function subscribe(
	listeners: ListenersData,
	action: string | string[],
	listener: Function,
	once: boolean,
	observe: (evn: Evn) => void
): ListenerUnsubscribe {
	if (typeof listener !== "function") {
		return () => {};
	}

	if (Array.isArray(action)) {
		const unsubscribes: ListenerUnsubscribe[] = [];
		for (let actionName of action) {
			if (typeof actionName === "string") {
				unsubscribes.push(subscribe(listeners, actionName, listener, once, observe));
			}
		}
		return () => {
			for (let unsubscribe of unsubscribes) {
				unsubscribe();
			}
		};
	}

	let evn: Evn | null = new Evn(listeners, action, listener, once);
	evn.close = () => {
		// delete an object from memory
		evn = null;
	};

	observe(evn);

	return evn.unsubscribe;
}

export function createPlainEvent(name: string, event: any) {
	const origin = event;
	let isOrigin = false;

	if (event == null) {
		event = {};
	} else if (!isPlainObject(event)) {
		isOrigin = true;
		event = {};
	}

	Object.defineProperty(event, "name", {
		get() {
			return name;
		},
		enumerable: true,
		configurable: false,
	});

	if (isOrigin) {
		Object.defineProperty(event, "origin", {
			get() {
				return origin;
			},
			enumerable: true,
			configurable: false,
		});
	}

	return event;
}
