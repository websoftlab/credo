import Koa from "koa";
import {
	appMiddleware,
	routeMiddleware,
	renderMiddleware,
	bodyParserMiddleware,
	sessionMiddleware,
	loadRoutes,
} from "./middleware";
import cluster from "cluster";
import {Worker, isMainThread} from 'worker_threads';
import {createCredoJS, BootMgr} from "./credo";
import cronService from "./cron/service";
import prettyMs from "pretty-ms";
import daemon from "./daemon";
import type {Context} from "koa";
import type {CredoJS, Server} from "./types";

export default async function server(options: Server.Options = {}) {

	// run cron service
	const {cronMode} = options;
	if(cronMode === "service") {
		return cronService(options);
	}

	const isProd = __PROD__ || options.mode === "production";
	if(isProd) {
		daemon().init();
	}

	const ended: Function[] = [];
	function done() {
		for(const end of ended) {
			end();
		}
	}

	const {
		registrar: registrarOption,
		publicPath = [],
	} = options;

	const registrar = registrarOption || new BootMgr();
	const app = new Koa();
	const isCluster = cluster.isWorker && options.process?.id === cluster.worker?.workerData?.id;
	const credo: CredoJS = await createCredoJS<CredoJS>(options, {
		mode: "app",
		cluster: isCluster,
		envMode: options.mode,
	}, {
		app,
		responders: {},
		middleware: {},
		controllers: {},
	});

	const defaultResponders = ["json", "text", "static"];
	if(credo.renderHTMLDriver != null) {
		defaultResponders.push("page");
	}

	for(let name of defaultResponders) {
		if(!registrar.defined("responders", name)) {
			registrar.responder(name, (await import((`@credo-js/responder-${name}`))).responder);
		}
	}

	const routeConfig = loadRoutes(credo);
	const {
		routes,
		isHost,
		route404,
		sort,
	} = routeConfig;

	// sort pattern
	if(sort === "pattern") {
		ended.push(() => {
			routes.sort((a, b) => {
				return (b.pattern ? b.pattern.length : -1) - (a.pattern ? a.pattern.length : -1);
			});
		});
	}

	credo.define("routes", function() { return routes; }, true);

	registrar.option("responders", "static", {publicPath});

	const {
		env,
		language,
		languages,
		multilingual,
	} = credo;

	app.on('error', err => {
		credo.debug.error('Server failure', err);
	});

	// check host
	app.use(async (ctx: Context, next) => {
		const time = Date.now();
		const delta = () => prettyMs(Date.now() - time);
		if(!isHost(ctx)) {
			credo.debug.route("invalid host {red %s} %s %s (%s) {red 400}", ctx.hostname, ctx.method, ctx.url, delta());
			ctx.throw(400, "Bad Request");
		} else {
			try {
				await next();
			} finally {
				credo.debug.route(
					`{blue [%s]} %s %s (%s) {${ctx.status < 300 ? "green" : "red"} %s}`,
					ctx.hostname,
					ctx.method,
					ctx.url,
					delta(),
					ctx.status
				);
			}
		}
	});

	const conf = credo.config("config");
	const {
		store = {},
	} = conf;

	bodyParserMiddleware(credo);
	sessionMiddleware(credo);
	appMiddleware(credo, {
		store,
		language,
		multilingual,
		languages,
	});

	// base routes
	registrar.middleware(routeMiddleware);

	const boot = await registrar.load(credo);

	function cron<T>(serv: T): T {
		if(isProd && !isCluster && !credo.process && !credo.isCron() && cronMode !== "disabled" && isMainThread) {
			const cron = credo.config("cron");
			if(cron.enabled) {
				const dmn = daemon();
				const argv: string[] = [];
				if(process.argv.includes("--no-pid")) {
					argv.push("--no-pid");
				}

				let cronWorker: Worker | undefined;
				credo.define("cronWorker", function() { return cronWorker; }, true);

				const startCron = () => {
					cronWorker = new Worker(require.main?.filename || process.argv[1], {
						workerData: {pid: process.pid, appMode: "cron"},
						argv,
					});
					cronWorker.on("message", (message) => {
						dmn.send(message);
					});
					cronWorker.on('exit', (code) => {
						cronWorker = undefined;
						credo.debug.error("Cron worker exit ({blue %s}), try restart after 10 seconds...", code);
						setTimeout(startCron, 10000);

						// send restart count
						dmn.send({
							type: "restart",
							id: "cron",
							part: 1,
							pid: dmn.pid,
							cid: 0,
						});
					});
				};
				startCron();
			}
		}
		return serv;
	}

	renderMiddleware(credo, {route404});

	const host = env.get("host").default("127.0.0.1").value;
	const port = env.get("port").default(1278).toPortNumber().value;
	const mode = env.get("mode").value;

	if(isProd) {
		const dmn = daemon();
		dmn.send({
			type: "detail",
			id: credo.process ? credo.process.id : "main",
			pid: dmn.pid,
			cid: process.pid,
			part: credo.process && cluster.worker?.workerData?.part || 1,
			port,
			host,
			mode: credo.mode,
		});
	}

	return boot()
		.then(done)
		.then(() => {
			return app.listen(port, host, () => {
				credo.debug(`Server is running at http://${host}:${port}/ - {cyan ${mode}} mode`);
			})
		})
		.then(cron);
}
