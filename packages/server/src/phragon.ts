import type { PhragonJSGlobal, Route, EnvMode, Server, Ctor, Env } from "./types";
import type { Context, Next } from "koa";
import asyncResult from "@phragon/utils/asyncResult";
import { debug, debugSubscribe } from "@phragon/cli-debug";
import { cmdBuild, preventBuildListener } from "./cmd/builder";
import { config } from "./config";
import ServerHooks from "./ServerHooks";
import { loadOptions } from "./utils";
import { cache, init as redisInit } from "./redis";
import cluster from "cluster";
import { createEnv } from "./envVar";
import { createLocalStore } from "./store";

type CJSDefType = "services" | "controllers" | "responders" | "middleware" | "cmd";
type CJSDefTypeExt = CJSDefType | "extraMiddleware";
type CJSDefTypeMwr = "services" | "controllers" | "responders" | "extraMiddleware" | "cmd";
type CJSOptions = { name: string; handler: Function; options?: any };
type CJSNoNameOptions = Omit<CJSOptions, "name">;
type CJSReg = Record<CJSDefTypeMwr, CJSOptions[]> & {
	middleware: CJSNoNameOptions[];
	options: Record<CJSDefTypeExt, Record<string, any>>;
	defined: string[];
	bootstrap: CJSNoNameOptions[];
	prepend: boolean;
};

const REG_KEY = Symbol();

function defineWithoutName(bootMgr: BootManager, key: "bootstrap" | "middleware", body: any) {
	const reg = bootMgr[REG_KEY];
	if (reg.prepend) {
		reg[key].unshift(body);
	} else {
		reg[key].push(body);
	}
}

function define(bootMgr: BootManager, key: CJSDefTypeExt, name: string, body: any) {
	const reg = bootMgr[REG_KEY];
	if (reg.prepend) {
		reg[key].unshift(body);
	} else {
		reg[key].push(body);
	}

	const def = reg.defined;
	let keyName = `${key}:${name}`;

	// origin key:name
	if (!def.includes(keyName)) {
		def.push(keyName);
	}

	// responder key:name
	if (key === "responders") {
		keyName = `middleware:${name}`;
		if (!def.includes(keyName)) {
			def.push(keyName);
		}
	}
}

function isObserver<T = any>(handler: any): handler is (phragon: PhragonJSGlobal, params?: any) => T {
	return typeof handler === "function" && handler.observer !== false;
}

export async function createPhragonJS<T extends PhragonJSGlobal>(
	server: Server.Options,
	options: {
		mode: string;
		envMode?: EnvMode;
		cluster?: boolean;
	},
	additional: Omit<T, keyof PhragonJSGlobal>
): Promise<T> {
	const { mode, cluster: isCluster = false, envMode = process.env.NODE_ENV || "development" } = options;

	const {
		process: proc,
		workerData,
		renderHTMLDriver,

		// exclude system vars
		publicPath,
		cmd,
		middleware,
		services,
		controllers,
		extraMiddleware,
		responders,
		bootstrap,

		...optionsEnv
	} = server;

	// hooks
	const hooks = new ServerHooks();

	debugSubscribe((event) => {
		return hooks.emit("onDebug", event);
	});

	const env = createEnv(loadOptions(optionsEnv));
	const lexicon = config("lexicon", {}, env);
	let { language, multilingual, languages = [] } = lexicon;

	if (language) {
		const index = languages.indexOf(language);
		if (index === -1) {
			languages.unshift(language);
		} else if (index !== 0) {
			languages.splice(index, 1);
			languages.unshift(language);
		}
	} else {
		language = languages[0] || "en";
	}

	if (multilingual === false) {
		languages.length = 0;
	} else if (multilingual !== true) {
		multilingual = languages.length > 1;
	}

	let boot = false;
	hooks.once("onBoot", () => {
		boot = true;
	});

	// local store
	let { dataPath } = config("config", {}, env);
	if (typeof dataPath === "object" && dataPath != null) {
		dataPath = dataPath[envMode as EnvMode];
	}
	if (!dataPath) {
		dataPath = proc?.mid ? `./data/data-${proc.mid}` : "./data";
	}
	const store = await createLocalStore(dataPath);

	// check languages
	if (!languages.includes(language)) {
		languages.unshift(language);
	}

	const def = (name: string, value: any, getterSetter?: true) => {
		const desc: PropertyDescriptor = {
			enumerable: true,
			configurable: false,
		};
		if (getterSetter) {
			if (Array.isArray(value)) {
				if (typeof value[0] === "function") {
					desc.get = value[0];
				}
				if (typeof value[1] === "function") {
					desc.set = value[1];
				}
			} else if (typeof value === "function") {
				desc.get = value;
			}
		} else {
			desc.value = value;
			desc.writable = false;
		}
		Object.defineProperty(phragon, name, desc);
	};

	const phragon = {
		get mode() {
			return mode;
		},
		get envMode() {
			return envMode;
		},
		get store() {
			return store;
		},
		get loaded() {
			return boot;
		},
		define: def,
		isApp() {
			return mode === "app";
		},
		isCron() {
			return mode === "cron";
		},
		isCmd() {
			return mode === "cmd";
		},
		config<T extends object = any>(name: string, def?: Partial<T>, _env: Env = env) {
			return config<T>(name, def, env);
		},
		hooks,
		debug,
		language,
		languages,
		multilingual,
		services: <any>{},
		env,
		...additional,
	} as PhragonJSGlobal;

	if (proc) {
		def("process", proc);
	}

	if (isCluster && cluster.isWorker && cluster.worker && workerData?.id === proc?.id) {
		def("worker", cluster.worker);
		def("workerData", workerData);
	}

	if (mode === "app") {
		def("renderHTMLDriver", renderHTMLDriver || null);
		def("ssr", renderHTMLDriver ? server.ssr !== false : false);
	}

	["mode", "envMode", "store", "loaded", "define", "isApp", "isCron", "isCmd", "config", "hooks", "debug"].forEach(
		(key) => {
			const desc = Object.getOwnPropertyDescriptor(phragon, key);
			if (!desc) {
				return;
			}
			desc.configurable = false;
			if (!desc.get && !desc.set) {
				desc.writable = false;
			}
			Object.defineProperty(phragon, key, desc);
		}
	);

	// initial cache
	const { enabled = false, ...redis } = config("redis", {}, env);
	if (enabled) {
		redisInit(redis);
		phragon.cache = cache;
	}

	// create global
	// @ts-ignore
	global.phragon = phragon;

	return phragon as T;
}

export class BootGetter<GetType = any> {
	get: () => GetType;
	constructor(getter: () => GetType) {
		this.get = getter;
	}
	static isGetter(object: any): object is BootGetter {
		return typeof object === "object" && object instanceof BootGetter;
	}
}

export class BootManager {
	[REG_KEY]: CJSReg = {
		prepend: false,
		services: [],
		controllers: [],
		responders: [],
		middleware: [],
		extraMiddleware: [],
		bootstrap: [],
		cmd: [],
		defined: [],
		options: {
			services: {},
			controllers: {},
			responders: {},
			middleware: {},
			extraMiddleware: {},
			cmd: {},
		},
	};

	option(key: CJSDefTypeExt, name: string, options: any) {
		if (this[REG_KEY].options[key]) {
			this[REG_KEY].options[key][name] = options;
		}
	}
	defined(key: CJSDefTypeExt, name: string) {
		return this[REG_KEY].defined.includes(`${key}:${name}`);
	}
	service<ServiceFunc = Function, Opt = unknown>(
		name: string,
		handler: Ctor.Service<ServiceFunc, Opt>,
		options?: Opt
	) {
		define(this, "services", name, { name, handler, options });
	}
	controller<ControllerFunc = Function, Opt = unknown>(
		name: string,
		handler: Ctor.Controller<ControllerFunc, Opt>,
		options?: Opt
	) {
		define(this, "controllers", name, { name, handler, options });
	}
	middleware<Opt = unknown>(handler: Ctor.Middleware<Opt>, options?: Opt) {
		defineWithoutName(this, "middleware", { handler, options });
	}
	extraMiddleware<MProps = unknown>(name: string, handler: Ctor.ExtraMiddleware<MProps>, options?: MProps) {
		define(this, "extraMiddleware", name, { name, handler, options });
	}
	responder<Conf = unknown>(name: string, handler: Ctor.Responder<Conf>, options?: Conf) {
		define(this, "responders", name, { name, handler, options });
	}
	cmd<Opt = unknown>(name: string, handler: Ctor.Commander<Opt>, options?: Opt) {
		define(this, "cmd", name, { name, handler, options });
	}
	bootstrap<Opt = unknown>(handler: Ctor.Bootstrap<Opt>, options?: Opt) {
		defineWithoutName(this, "bootstrap", { handler, options });
	}

	prepend(func: (bootMgr: BootManager) => void) {
		const reg = this[REG_KEY];
		const lastPrepend = reg.prepend;
		reg.prepend = true;
		func(this);
		reg.prepend = lastPrepend;
		return this;
	}

	async load(phragon: PhragonJSGlobal) {
		const bootKey: symbol = Symbol();
		const bootEvn: Record<string, boolean> = {};
		const bootHandler = (evn: any) => {
			const name = evn.name;
			if (evn[bootKey] !== true || bootEvn[name] === true) {
				throw new Error(
					`The \`${name}\` event is a system hook, you can not emit it outside the system, or re-emit`
				);
			}
			bootEvn[name] = true;
		};

		phragon.hooks.subscribe(["onLoad", "onBoot"], bootHandler);

		// prevent onBuild hook
		if (!phragon.hooks.has("onBuild", preventBuildListener)) {
			phragon.hooks.subscribe("onBuild", preventBuildListener);
		}

		if (phragon.isCmd()) {
			cmdBuild(phragon, phragon.cmd.command("build"));
		}

		const { services, controllers, responders, middleware, extraMiddleware, cmd, bootstrap, options } =
			this[REG_KEY];
		const rename = {
			cmd: "cmd",
			services: "service",
			controllers: "controller",
			responders: "responder",
			middleware: "extra middleware",
		};

		const prop = (key: CJSDefTypeMwr, name: string, props?: any) => {
			const opt = options[key][name];
			if (opt) {
				props = {
					...opt,
					...props,
				};
			}
			return props;
		};

		const each = async (items: any[], handler: (item: any) => Promise<any>) => {
			for (let i = 0; i < items.length; i++) {
				await handler(items[i]);
			}
		};

		const registerPropertyDescriptor: PropertyDescriptor & ThisType<any> = {
			enumerable: true,
			configurable: false,
		};

		const register = async (key: CJSDefType, name: string, handler: any, props?: any) => {
			if (phragon[key].hasOwnProperty(name)) {
				throw new Error(`The "${name}" ${rename[key]} already exists`);
			}
			if (isObserver(handler)) {
				const args: [PhragonJSGlobal, any?] = [phragon];
				if (key === "responders") {
					args.push(name);
				}
				props = prop(key === "middleware" ? "extraMiddleware" : key, name, props);
				if (props != null) {
					args.push(props);
				}
				handler = await asyncResult(handler(...args));
			}
			if (BootGetter.isGetter(handler)) {
				Object.defineProperty(phragon[key], name, {
					...registerPropertyDescriptor,
					get() {
						return handler.get();
					},
				});
			} else {
				Object.defineProperty(phragon[key], name, {
					...registerPropertyDescriptor,
					get() {
						return handler;
					},
				});
			}
		};

		const defs = [services];
		const keys: CJSDefType[] = ["services"];

		if (phragon.isApp()) {
			keys.push("controllers", "responders", "middleware");
			defs.push(controllers, responders, extraMiddleware);
		}

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (!phragon[key]) phragon[key] = {};
			await each(defs[i], ({ name, handler, options }: any) => register(key, name, handler, options));
		}

		if (phragon.isCmd()) {
			await each(cmd, ({ name, handler, options }: any) => {
				return handler(phragon, phragon.cmd.command(name), prop("cmd", name, options));
			});
		}

		// middleware
		if (phragon.isApp()) {
			const { app } = phragon;

			type MWare = {
				depth: number;
				observer: boolean;
				handler: Function | ((ctx: Context, next: Next) => void);
				options?: any;
			};

			const mwares: Array<MWare> = [];
			const mware = phragon.config("middleware");
			const { depths = {}, middleware: mrs = [] } = mware;

			let it = 1;
			const isDepth = (value: any): value is Number =>
				typeof value === "number" && !isNaN(value) && isFinite(value);
			const addMw = (
				handler: (() => any) | Function | Route.MiddlewareFunction,
				defaultName?: string,
				defaultDepth?: number,
				observer: boolean = false,
				handlerOptions: any = {}
			) => {
				let depth = it;
				let name = defaultName || handler.name || "";
				let opt = name ? options.middleware[name] : undefined;

				if (name && isDepth(depths[name])) {
					depth = depths[name];
				} else if (isDepth(defaultDepth)) {
					depth = defaultDepth;
				} else if ("depth" in handler && isDepth(handler.depth)) {
					depth = handler.depth;
				} else {
					it++;
				}

				if (handlerOptions) {
					opt = { ...opt, ...handlerOptions };
				}

				mwares.push({ depth, observer, handler, options: opt });
			};

			// custom middleware
			middleware.forEach(({ handler, options }: any) => {
				if (typeof handler === "function") {
					addMw(handler, undefined, undefined, isObserver(handler), options);
				}
			});

			it = it < 500 ? 500 : it;
			mrs.forEach((handler) => addMw(handler));

			it = it < 1000 ? 1000 : it;
			Object.keys(phragon.responders).forEach((name) => {
				const res = phragon.responders[name];
				addMw(
					(ctx: Context, next: Next) =>
						typeof res.middleware === "function" ? res.middleware(ctx, next) : next(),
					name,
					res.depth
				);
			});

			await each(
				mwares.sort((a, b) => a.depth - b.depth),
				async (mw: MWare) => {
					if (mw.observer) {
						const handler = await asyncResult(
							mw.options
								? (mw.handler as Function)(phragon, mw.options)
								: (mw.handler as Function)(phragon)
						);
						if (typeof handler === "function") {
							app.use(handler);
						}
					} else {
						app.use(mw.handler as () => void);
					}
				}
			);
		}

		return async () => {
			const complete: Function[] = [];

			// emit boostrap
			await each(bootstrap, async ({ handler, options }: any) => {
				if (typeof handler === "function") {
					try {
						const result = await asyncResult(options ? handler(phragon, options) : handler(phragon));
						if (typeof result === "function") {
							complete.push(result);
						}
					} catch (err) {
						debug.error("bootstrap failure", err);
					}
				}
			});

			await phragon.hooks.emit("onLoad", {
				[bootKey]: true,
				complete(handler: Function) {
					if (typeof handler === "function") {
						complete.push(handler);
					}
				},
			});

			await phragon.hooks.emit("onBoot", {
				[bootKey]: true,
			});

			// emit boostrap complete
			await each(complete, async (handler) => {
				try {
					await asyncResult(handler());
				} catch (err) {
					debug.error("bootstrap complete failure", err);
				}
			});
		};
	}
}
