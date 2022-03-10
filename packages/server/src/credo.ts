import type {CredoJS, CredoJSGlobal, Route, EnvMode, Server} from "./types";
import type {Cmd} from "./cmd/types";
import {asyncResult} from "@credo-js/utils";
import {debug, debugSubscribe} from "@credo-js/utils/srv/index";
import {cmdBuild, preventBuildListener} from "./cmd/builder";
import Koa from "koa";
import {config, loadTree} from "./config";
import ServerHooks from "./ServerHooks";
import {loadOptions} from "./utils";
import {cache, init as redisInit} from "./redis";
import cluster from "cluster";
import {createEnv} from "./envVar";
import {createLocalStore} from "./store";

type CJSRegHandler<T = void> = (credo: CredoJS, options?: any) => (Promise<T> | T);
type CJSDefType = "services" | "controllers" | "responders" | "middleware" | "cmd";
type CJSDefTypeExt = CJSDefType | "extraMiddleware";
type CJSDefTypeMwr = "services" | "controllers" | "responders" | "extraMiddleware" | "cmd";
type CJSOptions = { name: string, handler: Function, options?: any };
type CJSNoNameOptions = Omit<CJSOptions, "name">;
type CJSReg = Record<CJSDefTypeMwr, CJSOptions[]> & {
	middleware: CJSNoNameOptions[];
	options: Record<CJSDefTypeExt, Record<string, any>>;
	defined: string[];
	bootstrap: CJSNoNameOptions[];
	prepend: boolean;
};

const REG_KEY = Symbol();

function defineWithoutName(bootMgr: BootMgr, key: "bootstrap" | "middleware", body: any) {
	const reg = bootMgr[REG_KEY];
	if(reg.prepend) {
		reg[key].unshift(body);
	} else {
		reg[key].push(body);
	}
}

function define(bootMgr: BootMgr, key: CJSDefTypeExt, name: string, body: any) {
	const reg = bootMgr[REG_KEY];
	if(reg.prepend) {
		reg[key].unshift(body);
	} else {
		reg[key].push(body);
	}

	const def = reg.defined;
	let keyName = `${key}:${name}`;

	// origin key:name
	if(!def.includes(keyName)) {
		def.push(keyName);
	}

	// responder key:name
	if(key === "responders") {
		keyName = `middleware:${name}`;
		if(!def.includes(keyName)) {
			def.push(keyName);
		}
	}
}

function isObserver<T = any>(handler: any): handler is ((credo: CredoJSGlobal, params?: any) => T) {
	return typeof handler === "function" && handler.observer !== false;
}

export async function createCredoJS<T extends CredoJSGlobal>(
	server: Server.Options,
	options: {
		mode: string,
		envMode?: EnvMode,
		cluster?: boolean,
		env?: Record<string, any>,
	},
	additional: Omit<T, keyof CredoJSGlobal>
): Promise<T> {

	const {
		mode,
		cluster: isCluster = false,
		env = {},
		envMode = env.mode || process.env.NODE_ENV || "development",
	} = options;

	const {
		process: proc,
		configLoaders,
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

		... optionsEnv
	} = server;

	// hooks
	const hooks = new ServerHooks();

	debugSubscribe((event) => {
		return hooks.emit("onDebug", event);
	});

	await loadTree(proc?.cid, configLoaders);

	const lexicon = config("lexicon");
	let {
		language,
		multilingual,
		languages = [],
	} = lexicon;

	if(language) {
		const index = languages.indexOf(language);
		if(index === -1) {
			languages.unshift(language);
		} else if(index !== 0) {
			languages.splice(index, 1);
			languages.unshift(language);
		}
	} else {
		language = languages[0] || "en";
	}

	if(multilingual === false) {
		languages.length = 0;
	} else if(multilingual !== true) {
		multilingual = languages.length > 1;
	}

	let boot = false;
	hooks.once("boot", () => { boot = true; });

	// local store
	let {dataPath} = config("config");
	if(typeof dataPath === "object" && dataPath != null) {
		dataPath = dataPath[envMode as EnvMode];
	}
	if(!dataPath) {
		dataPath = proc?.id ? `./data/data-${proc.id}` : "./data";
	}
	const store = await createLocalStore(dataPath);

	// check languages
	if (!languages.includes(language)) {
		languages.unshift(language);
	}

	Object.assign(env, loadOptions(optionsEnv));

	const def = (name: string, value: any) => {
		Object.defineProperty(credo, name, { value, enumerable: true, writable: false, configurable: false });
	};

	const credo = {
		get mode() { return mode; },
		get envMode() { return envMode; },
		get store() { return store; },
		get loaded() { return boot; },
		define: def,
		isApp() { return mode === "app"; },
		isCron() { return mode === "cron"; },
		isCmd() { return mode === "cmd"; },
		config,
		hooks,
		debug,
		language,
		languages,
		multilingual,
		services: {},
		env: createEnv(env),
		cron: {},
		... additional,
	} as CredoJSGlobal;

	if(proc) {
		def("process", proc);
	}

	if(isCluster && cluster.isWorker && cluster.worker && workerData?.cid === proc?.cid) {
		def("worker", cluster.worker);
		def("workerData", workerData);
	}

	if(mode === "app") {
		def("renderHTMLDriver", renderHTMLDriver || null);
	}

	["mode", "envMode", "store", "loaded", "define", "isApp", "isCron", "isCmd", "config", "hooks", "debug"].forEach(key => {
		Object.defineProperty(credo, key, { writable: false, configurable: false });
	});

	// initial cache
	const {enabled = false, ...redis} = config("redis");
	if (enabled) {
		redisInit(redis);
		credo.cache = cache;
	}

	// create global
	// @ts-ignore
	global.credo = credo;

	return credo as T;
}

export class BootMgr {

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
		if(this[REG_KEY].options[key]) {
			this[REG_KEY].options[key][name] = options;
		}
	}
	defined(key: CJSDefTypeExt, name: string) {
		return this[REG_KEY].defined.includes(`${key}:${name}`);
	}
	service(name: string, handler: CJSRegHandler, options?: any) {
		define(this, "services", name, {name, handler, options});
	}
	controller(name: string, handler: CJSRegHandler, options?: any) {
		define(this, "controllers", name, {name, handler, options});
	}
	middleware(handler: CJSRegHandler | Function, options?: any) {
		defineWithoutName(this, "middleware", { handler, options });
	}
	extraMiddleware(name: string, handler: CJSRegHandler, options?: any) {
		define(this, "extraMiddleware", name, {name, handler, options});
	}
	responder(name: string, handler: Route.ResponderCtor, options?: any) {
		define(this, "responders", name, {name, handler, options});
	}
	cmd(name: string, handler: Cmd.CommanderCtor, options?: any) {
		define(this, "cmd", name, {name, handler, options});
	}
	bootstrap(handler: CJSRegHandler, options?: any) {
		defineWithoutName(this, "bootstrap", { handler, options });
	}

	prepend(func: (bootMgr: BootMgr) => void) {
		const reg = this[REG_KEY];
		const lastPrepend = reg.prepend;
		reg.prepend = true;
		func(this);
		reg.prepend = lastPrepend;
		return this;
	}

	async load(credo: CredoJSGlobal) {

		const bootKey: symbol = Symbol();
		const bootEvn: Record<string, boolean> = {};
		const bootHandler = (evn: any) => {
			const name = evn.name;
			if(evn[bootKey] !== true || bootEvn[name] === true) {
				throw new Error(`The \`${name}\` event is a system hook, you can not emit it outside the system, or re-emit`);
			}
			bootEvn[name] = true;
		};

		credo.hooks.subscribe(["onLoad", "onBoot"], bootHandler);

		// prevent onBuild hook
		if(!credo.hooks.has("onBuild", preventBuildListener)) {
			credo.hooks.subscribe("onBuild", preventBuildListener);
		}

		if(credo.isCmd()) {
			await credo.cmd.register("build", cmdBuild);
		}

		const {services, controllers, responders, middleware, extraMiddleware, cmd, bootstrap, options} = this[REG_KEY];
		const rename = {
			cmd: "cmd",
			services: "service",
			controllers: "controller",
			responders: "responder",
			middleware: "extra middleware",
		};

		const prop = (key: CJSDefTypeMwr, name: string, props?: any) => {
			const opt = options[key][name];
			if(opt) {
				props = {
					... opt,
					... props,
				};
			}
			return props;
		};

		const each = async (items: any[], handler: (item: any) => Promise<any>) => {
			for(let i = 0; i < items.length; i++) {
				await handler(items[i]);
			}
		};

		const register = async (key: CJSDefType, name: string, handler: any, props?: any) => {
			if(credo[key].hasOwnProperty(name)) {
				throw new Error(`The "${name}" ${rename[key]} already exists`);
			}
			if(isObserver(handler)) {
				const args: [CredoJSGlobal, any?] = [credo];
				if(key === "responders") {
					args.push(name);
				}
				props = prop(key === "middleware" ? "extraMiddleware" : key, name, props);
				if(props != null) {
					args.push(props);
				}
				handler = await asyncResult(handler(...args));
			}
			Object.defineProperty(credo[key], name, {
				get() {
					return handler;
				},
				enumerable: true,
				configurable: false,
			});
		};

		const defs = [services];
		const keys: CJSDefType[] = ["services"];

		if(credo.isApp()) {
			keys.push("controllers", "responders", "middleware");
			defs.push( controllers,   responders,   extraMiddleware);
		}

		for(let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if(!credo[key]) credo[key] = {};
			await each(defs[i], ({name, handler, options}: any) => register(key, name, handler, options));
		}

		if(credo.isCmd()) {
			await each(cmd, ({name, handler, options}: any) => {
				return credo.cmd.register(name, handler, prop("cmd", name, options));
			});
		}

		// middleware
		if(credo.isApp()) {
			const {app} = credo;

			type MWare = {
				depth: number;
				observer: boolean;
				handler: Function | ((ctx: Koa.Context, next: Koa.Next) => void);
				options?: any;
			};

			const mwares: Array<MWare> = [];
			const mware = credo.config("middleware");
			const {depths = {}, middleware: mrs = []} = mware;

			let it = 1;
			const isDepth = (value: any): value is Number => typeof value === "number" && ! isNaN(value) && isFinite(value);
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

				if(name && isDepth(depths[name])) {
					depth = depths[name];
				} else if(isDepth(defaultDepth)) {
					depth = defaultDepth;
				} else if("depth" in handler && isDepth(handler.depth)) {
					depth = handler.depth;
				} else {
					it ++;
				}

				if(handlerOptions) {
					opt = {... opt, ... handlerOptions};
				}

				mwares.push({depth, observer, handler, options: opt});
			};

			// custom middleware
			middleware.forEach(({handler, options}: any) => {
				if (typeof handler === "function") {
					addMw(handler, undefined, undefined, isObserver(handler), options);
				}
			});

			it = it < 500 ? 500 : it;
			mrs.forEach(handler => addMw(handler));

			it = it < 1000 ? 1000 : it;
			Object.keys(credo.responders).forEach(name => {
				const res = credo.responders[name];
				addMw((ctx: Koa.Context, next: Koa.Next) => typeof res.middleware === "function" ? res.middleware(ctx, next) : next(), name, res.depth);
			});

			await each(mwares.sort((a, b) => a.depth - b.depth), async (mw: MWare) => {
				if(mw.observer) {
					const handler = await asyncResult(mw.options ? (mw.handler as Function)(credo, mw.options) : (mw.handler as Function)(credo));
					if(typeof handler === "function") {
						app.use(handler);
					}
				} else {
					app.use(mw.handler as () => void);
				}
			});
		}

		return async () => {
			const complete: Function[] = [];

			// emit boostrap
			await each(bootstrap, async ({handler, options}: any) => {
				if(typeof handler === "function") {
					try {
						const result = await asyncResult(options ? handler(credo, options) : handler(credo));
						if(typeof result === "function") {
							complete.push(result);
						}
					} catch(err) {
						debug.error("bootstrap failure", err);
					}
				}
			});

			await credo.hooks.emit("onLoad", {
				[bootKey]: true,
				complete(handler: Function) {
					if(typeof handler === "function") {
						complete.push(handler);
					}
				}
			});

			await credo.hooks.emit("onBoot", {
				[bootKey]: true,
			});

			// emit boostrap complete
			await each(complete, async (handler) => {
				try {
					await asyncResult(handler());
				} catch(err) {
					debug.error("bootstrap complete failure", err);
				}
			});
		};
	}
}