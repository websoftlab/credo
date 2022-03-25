import Koa from "koa";
import {
	appMiddleware,
	routeMiddleware,
	renderMiddleware,
	bodyParserMiddleware,
	sessionMiddleware,
	loadRoutes,
} from "./middleware";
import {createStaticOptions} from "./utils";
import cluster from "cluster";
import {Worker, isMainThread} from 'worker_threads';
import {createCredoJS, BootMgr} from "./credo";
import cronService from "./cron/service";
import prettyMs from "pretty-ms";
import type {Context} from "koa";
import type {CredoJS, Server} from "./types";

export default async function server(options: Server.Options = {}) {

	// run cron service
	if(options.cronMode === "service") {
		return cronService(options);
	}

	const {
		registrar: registrarOption,
		publicPath = [],
	} = options;

	const registrar = registrarOption || new BootMgr();
	const app = new Koa();
	const isCluster = cluster.isWorker && options.process?.cid === cluster.worker?.workerData?.cid;
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
	} = routeConfig;

	Object.defineProperty(credo, "routes", { get() { return routes; }, enumerable: true, configurable: false });

	registrar.option("responders", "static", createStaticOptions(publicPath, options.process?.id));

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
	const complete = async () => {
		// bootstrap
		await boot();

		// cron
		if(!isCluster && !credo.process && !credo.isCron()) {
			const cron = credo.config("cron");
			if(cron.enabled && isMainThread) {
				const startCron = () => {
					const cronWorker = new Worker(require.main?.filename || process.argv[1], {
						workerData: "cron",
					});
					cronWorker.on('exit', (code) => {
						credo.cronWorker = undefined;
						credo.debug.error("Cron worker exit ({blue %s}), try restart after 10 seconds...", code);
						setTimeout(startCron, 10000);
					});
					credo.cronWorker = cronWorker;
				};
				startCron();
			}
		}

		return credo;
	};

	renderMiddleware(credo, {route404});

	const host = env.get("host").default("127.0.0.1").value;
	const port = env.get("port").default(1278).toPortNumber().value;
	const mode = env.get("mode").value;

	return new Promise((resolve, reject) => {
		try {
			const server = app.listen(port, host, () => {
				credo.debug(`Server is running at http://${host}:${port}/ - {cyan ${mode}} mode`);
				complete()
					.then(() => {
						resolve(server);
					})
					.catch((err) => {
						reject(err);
						server.close();
					});
			});
		} catch (err) {
			reject(err);
		}
	});
}
