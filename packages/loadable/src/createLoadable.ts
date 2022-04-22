import type {
	CreateLoadableOptions,
	Loader,
	Loadable,
	Initializer,
	Options,
	RenderHandler,
	FallbackHandler,
} from "./types";
import { isPlainObject } from "@credo-js/utils";

function delFrom<T>(all: T[], item: T) {
	const index = all.indexOf(item);
	if (index !== -1) {
		all.splice(index, 1);
	}
}

export default function createLoadable<Type, Element, FallbackProps>(
	options: CreateLoadableOptions<Type, Element, FallbackProps>
): Loadable<Type, Element, FallbackProps> {
	const allInitializers: Initializer[] = [];
	const named: Record<string, Type> = {};
	const namedId: Record<string, number> = {};
	const namedInitializers: Record<string, Initializer> = {};
	const loadedNames: string[] = [];
	const { render, observer, fallback } = options;

	let lastId = 1;

	async function promiseAll(all: (() => Promise<any>)[]) {
		return Promise.all(all.map((func) => func()));
	}

	function createLoaderFromArray(loader: Loader[]): Loader {
		return () => promiseAll(loader);
	}

	function createLoaderFromPlainObject(loader: Record<string, Loader>): Loader {
		const keys = Object.keys(loader);
		return async () => {
			const data: any = {};
			await Promise.all(
				keys.map(async (key) => {
					data[key] = await loader[key]();
				})
			);
			return data;
		};
	}

	function isPlainLoader(loader: any): loader is Record<string, Loader> {
		return loader !== null && isPlainObject(loader);
	}

	function loadable(options: Options<Element, FallbackProps>): Type {
		const { loader } = options;
		options = {
			throwable: false,
			delay: 200,
			...options,
		};

		let loaderFn: Loader;

		if (isPlainLoader(loader)) {
			loaderFn = createLoaderFromPlainObject(loader);
		} else if (Array.isArray(loader)) {
			loaderFn = createLoaderFromArray(loader);
		} else if (!options.render) {
			loaderFn = loader;
			options.render = render;
		}

		if (typeof options.render !== "function") {
			throw new Error(`Loadable requires a "function render(loaded, props)" option`);
		}

		if (!options.fallback && !options.throwable) {
			throw new Error(`Loadable requires a "fallback" option or a "throwable" option`);
		}

		const renderFn: RenderHandler<Element> = options.render;
		const fallbackFn: FallbackHandler<Element> = options.fallback || fallback;

		const { name, throwable = false, delay, timeout } = options;

		if (!name) {
			throw new Error(`Loadable requires a "name" option`);
		}

		if (defined(name)) {
			throw new Error(`Duplicate loadable name "${name}"`);
		}

		const myId = lastId++;

		namedId[name] = myId;

		let loading: boolean = false;
		let done: boolean = false;
		let error: false | Error = false;
		let response: any = null;
		let promise: Promise<any> | null = null;

		function reset() {
			loading = false;
			done = false;
			error = false;
			response = null;
			promise = null;
		}

		function init() {
			if (done) {
				return error ? Promise.reject(error) : Promise.resolve(response);
			}
			if (!promise) {
				loading = true;
				promise = loaderFn()
					.then((result) => {
						done = true;
						loading = false;
						error = false;
						response = result;

						// compare component version
						if (myId === namedId[name]) {
							// clear initializers
							delFrom(allInitializers, init);
							delete namedInitializers[name];

							// save loading
							if (!loaded(name)) {
								loadedNames.push(name);
							}
						}
					})
					.catch((err) => {
						done = true;
						loading = false;
						error = err;
						response = null;

						return err;
					});
			}
			return promise;
		}

		allInitializers.push(init);

		const Component = observer({
			name,
			init,
			reset,
			isDone() {
				return done;
			},
			isLoading() {
				return loading;
			},
			done(err: Error | false, props: any, createFallbackProps: (err: Error | false) => FallbackProps): Element {
				if (error) {
					err = error;
				}

				if (err && throwable) {
					throw err;
				}

				if (done) {
					return renderFn(response, props);
				}

				// for server side
				if (__SRV__ && promise == null) {
					init().then(() => {
						console.log(
							`Warning, use loadAll() function for server side rendering. Component "${name}" is not loaded.`
						);
					});
				}

				return fallbackFn(createFallbackProps(err));
			},
			delay,
			timeout,
		});

		if (name) {
			named[name] = Component;
			namedInitializers[name] = init;
		}

		return Component;
	}

	async function loadAll(depth: number = 2) {
		if (depth < 1 || isNaN(depth) || !isFinite(depth)) {
			depth = 1;
		}
		const startDepth = depth;
		while (depth > 0 && allInitializers.length > 0) {
			await promiseAll(allInitializers);
			depth--;
		}
		if (__DEV__) {
			allInitializers.length > 0 && console.error(`Not all bootloaders are initiated (depth = ${startDepth})`);
		}
	}

	async function load(name: string | string[]): Promise<void> {
		const initializers: Initializer[] = [];
		(typeof name === "string" ? [name] : name).forEach((name) => {
			if (namedInitializers.hasOwnProperty(name)) {
				initializers.push(namedInitializers[name]);
			} else if (!defined(name)) {
				throw new Error(`The "${name}" component is not defined`);
			}
		});
		if (initializers.length) {
			await promiseAll(initializers);
		}
	}

	function defined(name: string): boolean {
		return named.hasOwnProperty(name);
	}

	function loaded(name: string): boolean {
		return loadedNames.includes(name);
	}

	function definedComponents(): string[] {
		return Object.keys(named);
	}

	function loadedComponents(): string[] {
		return loadedNames.slice();
	}

	function component(name: string): Type {
		if (!defined(name)) {
			throw new Error(`The "${name}" component is not defined`);
		}
		return named[name];
	}

	function del(name: string) {
		if (!defined(name)) {
			return false;
		}
		delete named[name];
		delete namedId[name];
		if (namedInitializers.hasOwnProperty(name)) {
			delFrom(allInitializers, namedInitializers[name]);
			delete namedInitializers[name];
		}
		delFrom(loadedNames, name);
		return false;
	}

	function reset(name: string | string[]) {
		if (!Array.isArray(name)) {
			name = [name];
		}
		let count = 0;
		name.forEach((name) => {
			if (del(name)) {
				count++;
			}
		});
		return count;
	}

	function resetAll() {
		return reset(Object.keys(named));
	}

	return {
		load,
		loadAll,
		defined,
		loaded,
		definedComponents,
		loadedComponents,
		component,
		loadable,
		reset,
		resetAll,
	};
}
