import type { PhragonConfig, PhragonPlugin } from "../types";
import type { BuilderStoreI } from "./BuilderStore";
import { DaemonSignKill } from "../types";
import { isPlainObject } from "@phragon/utils";

const SET_ID = Symbol();

function set<T extends {}>(builder: PhragonBuilder, name: string, value: T) {
	builder[SET_ID].phragon(name, value);
}

export interface PhragonBuilderI {
	lexicon(language: string, options?: Omit<PhragonConfig.Lexicon, "language">): this;
	lexicon(options: PhragonConfig.Lexicon): this;
	cluster(id: string, config?: Omit<PhragonConfig.Cluster, "id">): this;
	render(driver: string, ssr?: boolean, renderOptions?: any): this;
	renderable(renderable: boolean): this;
	middleware(...middleware: PhragonConfig.Handler[]): this;
	extraMiddleware(name: string, middleware?: PhragonConfig.Handler): this;
	responder(name: string, responder?: PhragonConfig.Handler): this;
	service(name: string, service?: PhragonConfig.Handler): this;
	controller(name: string, controller?: PhragonConfig.Handler): this;
	cmd(name: string, cmd?: PhragonConfig.Handler): this;
	configLoader(type: string, loader: PhragonConfig.Handler): this;
	publicPath(path: string /* todo: , config: PublicPathOptions ... */): this;
	buildTimeout(value: string | number): this;
	daemon(
		pid?: string | null,
		delay?: number | null,
		cpuPoint?: number | null,
		killSignal?: DaemonSignKill | null
	): this;
	daemon(value: PhragonPlugin.DaemonOptions): this;
}

function normalizePath(type: string, name: string, handler?: PhragonConfig.Handler) {
	if (!handler) {
		handler = `./src-server`;
		if (type) {
			handler += `/${type}`;
		}
		if (name) {
			handler += `/${name}`;
		}
	}
	if (typeof handler === "string") {
		handler = {
			path: handler,
		};
	}
	let path = String(handler.path).replace(/\\/g, "/");
	if (path.startsWith("/")) {
		path = `.${path}`;
	}
	handler.path = path;
	return handler;
}

export default class PhragonBuilder implements PhragonBuilderI {
	[SET_ID]: BuilderStoreI;

	constructor(store: BuilderStoreI) {
		this[SET_ID] = store;
	}

	cluster(id: string, config?: Omit<PhragonConfig.Cluster, "id">): this {
		set(this, "cluster", { ...config, id });
		return this;
	}

	cmd(name: string, cmd?: PhragonConfig.Handler): this {
		set(this, "cmd", { name, cmd: normalizePath("cmd", name, cmd) });
		return this;
	}

	controller(name: string, controller?: PhragonConfig.Handler): this {
		set(this, "controller", { name, controller: normalizePath("controllers", name, controller) });
		return this;
	}

	extraMiddleware(name: string, middleware?: PhragonConfig.Handler): this {
		set(this, "extraMiddleware", { name, middleware: normalizePath("middleware", name, middleware) });
		return this;
	}

	lexicon(language: string, options?: Omit<PhragonConfig.Lexicon, "language">): this;
	lexicon(options: PhragonConfig.Lexicon): this;
	lexicon(language: string | PhragonConfig.Lexicon, options?: Omit<PhragonConfig.Lexicon, "language">): this {
		let lexicon: PhragonConfig.Lexicon;
		if (typeof language === "string") {
			lexicon = {
				...options,
				language,
			};
		} else {
			lexicon = {
				...language,
			};
		}
		set(this, "lexicon", lexicon);
		return this;
	}

	middleware(...middleware: PhragonConfig.Handler[]): this {
		middleware.forEach((m) => {
			set(this, "middleware", { middleware: normalizePath("", "", m) });
		});
		return this;
	}

	configLoader(type: string, loader: PhragonConfig.Handler): this {
		set(this, "configLoader", { type, loader });
		return this;
	}

	publicPath(path: string): this {
		set(this, "publicPath", { path });
		return this;
	}

	render(driver: string, ssr: boolean = false, renderOptions: any = {}): this {
		set(this, "render", { driver, ssr, renderOptions });
		return this;
	}

	renderable(renderable: boolean): this {
		set(this, "renderable", { renderable });
		return this;
	}

	responder(name: string, responder?: PhragonConfig.Handler): this {
		set(this, "responder", { name, responder: normalizePath("responders", name, responder) });
		return this;
	}

	service(name: string, service?: PhragonConfig.Handler): this {
		set(this, "service", { name, service: normalizePath("services", name, service) });
		return this;
	}

	buildTimeout(value: string | number) {
		set(this, "buildTimeout", { value });
		return this;
	}

	daemon(
		pid?: string | null,
		delay?: number | null,
		cpuPoint?: number | null,
		killSignal?: DaemonSignKill | null
	): this;
	daemon(value: PhragonPlugin.DaemonOptions): this;
	daemon(
		pid?: string | null | PhragonPlugin.DaemonOptions,
		delay?: number | null,
		cpuPoint?: number | null,
		killSignal?: DaemonSignKill | null
	) {
		if (arguments.length < 1) {
			return this;
		}
		if (isPlainObject(pid)) {
			set(this, "daemon", { ...(pid as PhragonPlugin.DaemonOptions) });
		} else {
			const opt: PhragonPlugin.DaemonOptions = {};
			if (typeof pid === "string" && pid.length) {
				opt.pid = pid;
			}
			if (delay != null) {
				opt.delay = delay;
			}
			if (cpuPoint != null) {
				opt.cpuPoint = cpuPoint;
			}
			if (killSignal) {
				opt.killSignal = killSignal;
			}
			set(this, "daemon", opt);
		}
		return this;
	}
}
