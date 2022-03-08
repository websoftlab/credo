import {createLoadable, TimeoutError} from "@credo-js/loadable";
import {createContext, useContext, createElement, useState, useRef, useCallback, useEffect} from "react";
import type {ObserverOptions} from "@credo-js/loadable";

function resolve<Type>(obj: any): Type {
	return obj && obj.__esModule ? obj.default : obj;
}

export interface ReactFallbackProps {
	loading: boolean;
	error: Error | false;
	pastDelay: boolean;
	retry(): void;
}

export const CaptureContext = createContext<string[] | null>(null);

function observer(options: ObserverOptions<JSX.Element, ReactFallbackProps>) {

	const {
		name,
		init,
		reset,
		isDone,
		isLoading,
		delay,
		timeout,
		done,
	} = options;

	const makeState = (id: number, pastDelay: boolean = false): {
		id: number,
		pastDelay: boolean,
		error: false | Error,
	} => ({
		id,
		pastDelay: delay === 0 || pastDelay,
		error: false,
	});

	const Component = function(props: any): JSX.Element {
		const [state, setState] = useState(() => makeState(1));
		const initial = useRef(true);

		// capture element
		const ctx = useContext(CaptureContext);
		if(ctx && !ctx.includes(name)) {
			ctx.push(name);
		}

		const retry = useCallback(() => {
			if(isDone()) {
				setState(old => makeState(old.id + 1, true));
			} else {
				reset();
				setState(old => makeState(old.id + 1));
			}
		}, []);

		if(!__SSR__) {
			useEffect(() => {
				if(isDone() || typeof window === "undefined") {
					return;
				}

				let mount = true;

				const timerId = timeout ? window.setTimeout(() => {
					if(mount && isLoading()) {
						setState(old => ({... old, error: new TimeoutError()}));
					}
				}, timeout) : 0;

				const delayId = delay ? window.setTimeout(() => {
					if(mount && !isDone()) {
						setState(old => ({... old, pastDelay: true}));
					}
				}, delay) : 0;

				const clear = () => {
					clearTimeout(timerId);
					clearTimeout(delayId);
				};

				init()
					.then(() => {
						if(mount) {
							clear();
							setState(old => ({
								... old,
								error: old.error instanceof TimeoutError ? old.error : false,
								pastDelay: true,
							}));
						}
					})
					.catch((err) => {
						if(mount) {
							clear();
							setState(old => ({
								... old,
								error: old.error || err,
							}));
						}
						return err;
					});

				initial.current = false;

				return () => {
					mount = false;
					clear();
				};
			}, [state.id]);
		}

		return done(state.error, props, (err: Error | false) => ({
			get loading() { return initial.current || isLoading(); },
			get error() { return err; },
			get pastDelay() { return state.pastDelay; },
			retry,
		}));
	};

	if(name && __DEV__) {
		Component.displayName = name;
	}

	return Component;
}

const {
	load,
	loadAll,
	defined,
	loaded,
	definedComponents,
	loadedComponents,
	component,
	loadable,
} = createLoadable({
	render(loaded: any, props: any) {
		return createElement(resolve(loaded), props);
	},
	fallback() {
		return createElement(() => null);
	},
	observer
});

export {
	load,
	loadAll,
	defined,
	loaded,
	definedComponents,
	loadedComponents,
	component,
	loadable,
};
