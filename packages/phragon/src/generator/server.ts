import { debug } from "../debug";
import { CmpJS } from "@phragon/cli-cmp";
import { buildPath, createCwdDirectoryIfNotExists, exists, writeBundleFile, writeJsonFile } from "../utils";
import { PhragonPlugin } from "../types";
import { writeFile } from "node:fs/promises";
import createRelativePath from "./createRelativePath";
import { randomBytes } from "node:crypto";

async function writeLoadable() {
	const file = buildPath("./loadable.js");
	if (!(await exists(file))) {
		await writeFile(
			file,
			`import {join, dirname, sep} from "path";
import {watchFile, unwatchFile, existsSync} from "fs";

async function load(file, loadable) {
	if(typeof loadable === "string") {
		loadable = require(loadable);
	}
	if(__DEV__) {
		if(loadable != null && typeof loadable.resetAll === "function") {
			loadable.resetAll();
		}
		const prefix = dirname(require.resolve(file)) + sep;
		Object.keys(require.cache).forEach(file => {
			if(file.startsWith(prefix)) {
				delete require.cache[file];
			}
		});
	}
	require(file);
	if(loadable != null && typeof loadable.loadAll === "function") {
		await loadable.loadAll();
	}
}

export default async function loadable(phragon, file, importer) {
	if(!phragon.isApp()) {
		return phragon.debug("Server-side rendering is used only in application mode, bootstrap is ignored...");
	}
	if(!phragon.ssr || !__SSR__) {
		return;
	}
	file = join(process.cwd(), file);
	if(__DEV__) {
		let reload = false;
		watchFile(file, (stats) => {
			if(stats && stats.size > 0) {
				reload = true;
			}
		});
		phragon.hooks.subscribe("onPageHTMLBeforeRender", async ({document}) => {
			if(document.ssr && reload) {
				await load(file, importer);
				reload = false;
			}
		});
		phragon.hooks.subscribe("onExit", () => {
			unwatchFile(file);
		});
		if(existsSync(file)) {
			await load(file, importer);
		}
	} else {
		await load(file, importer);
	}
}`
		);
	}
}

async function writeDevPingPong() {
	const file = buildPath("./ping-pong.js");
	if (!(await exists(file))) {
		await writeFile(
			file,
			`import {randomBytes} from "crypto";
function send(message) {
	if(process.send) {
		process.send(message);
	}
}
function exit(error) {
	if(error) {
		send(error.message);
	}
	const code = error ? 1 : 0;
	phragon
		.hooks
		.emit("onExit", { code, error })
		.then(() => {
			 process.exit(code);
		})
		.catch((err) => {
			err && send(err.message);
			process.exit(1);
		});
}
export default async function pingPong(server) {
	const id = randomBytes(5).toString("hex");
	process.on("message", (message) => {
		if(message === "ping") {
			send(\`pong \${id}\`);
		} else if(message === \`exit \${id}\`) {
			server.close(exit);
		}
	});
}`
		);
	}
}

export async function buildServer(factory: PhragonPlugin.Factory) {
	const { render, page, ssr, configLoader, cluster: clusterList } = factory;

	const cJs = new CmpJS();
	const srv = cJs.imp("@phragon/server", "*");
	const buildId = randomBytes(32).toString("hex");
	const buildVersion = factory.root.version;

	cJs.set("worker_threads", "isMainThread");
	cJs.set("worker_threads", "workerData");

	// cluster.isPrimary or isMaster
	const clusterName = cJs.imp("cluster");
	cJs.append(
		`function isPrimaryCluster() { return "isPrimary" in ${clusterName} ? ${clusterName}.isPrimary : ${clusterName}.isMaster; }`
	);

	type XType = "service" | "controller" | "responder" | "middleware" | "extraMiddleware" | "cmd";

	const isClusterMode = clusterList.length > 0;
	const publicPath: string[] = [];
	const rk: Record<XType | "reg" | "bootstrap", string[]> = {
		service: [],
		controller: [],
		responder: [],
		middleware: [],
		extraMiddleware: [],
		bootstrap: [],
		cmd: [],
		reg: [],
	};

	function isAcs(
		func: { path: string; importer: string },
		typeName: [XType | "bootstrap", string],
		append: boolean = true
	) {
		const key = `${func.path}@${func.importer}`;
		if (rk.reg.includes(key)) {
			return false;
		}
		const [type, name] = typeName;
		if (rk[type].includes(name)) {
			type !== "middleware" &&
				type !== "bootstrap" &&
				debug.error(`WARNING! Duplicate %s name: {yellow %s}`, type, name);
			return false;
		}
		if (append) {
			rk.reg.push(key);
			rk[type].push(name);
		}
		return true;
	}

	function register(type: XType, data: PhragonPlugin.HandlerOptional, name: string) {
		let { path, importer, options } = data;
		const func = cJs.imp(createRelativePath(path, ".phragon"), importer);
		if (isAcs(data, [type, name])) {
			cJs.append(
				`registrar.${type}(${cJs.tool.esc(name)}, ${func}${options ? `, ${cJs.tool.esc(options)}` : ""});`
			);
		}
	}

	// set ENV
	cJs.nl().append([
		`const IS_SSR = __SSR__${isClusterMode ? "" : ' && !process.argv.includes("--cron")'};`,
		`const data = ${srv}.env();`,
		"Object.keys(data).forEach(key => { process.env[key] = data[key]; });",
		`${cJs.imp("@phragon-util/global-var", "defineGlobal")}(__ENV__, IS_SSR);`,
		`${cJs.imp("@phragon/cli-debug", "debugEnable")}(data.DEBUG);`,
	]);

	// set const
	cJs.nl().append([
		`const configLoaders = {};`,
		`const isCmd = __PROD__ && process.env.APP_MODE === "cmd";`,
		isClusterMode ? `const clusters = {};` : "",
		`let clusterId = null;`,
	]);

	if (isClusterMode) {
		cJs.nl().group("if(!isCmd && (__DEV__ || !isPrimaryCluster()))", "", () => {
			// define cluster obj
			cJs.group("Object.assign(clusters,", ");", () => {
				clusterList.forEach((cluster) => {
					cJs.append(`${cJs.tool.esc(cluster.id)}: ${cluster.mid},`);
				});
			});

			cJs.group("if(__PROD__)", "", () => {
				cJs.group(
					'if(process.env.APP_MODE !== "cluster" || ! clusters.hasOwnProperty(process.env.APP_ID))',
					"",
					() => {
						cJs.append(`throw new Error("Invalid or empty cluster ID");`);
					}
				).group("else", "", () => {
					cJs.append(`clusterId = process.env.APP_ID;`);
				});
			}).group(`else`, "", () => {
				cJs.append(
					`clusterId = clusters.hasOwnProperty(process.env.APP_ID) ? process.env.APP_ID : ${cJs.tool.esc(
						clusterList[0].id
					)};`
				);
			});
		});
	}

	// set config loaders
	if (configLoader.length > 0) {
		cJs.nl().group("Object.assign(configLoaders,", ");", () => {
			configLoader.forEach((item) => {
				const {
					type,
					loader: { path, importer },
				} = item;
				cJs.append(`${cJs.tool.esc(type)}: ${cJs.imp(createRelativePath(path, ".phragon"), importer)},`);
			});
		});
	}

	cJs.nl().append(`${cJs.imp("@phragon/server/config", "loadTree")}(clusterId, __ENV__, configLoaders);`);

	cJs.nl()
		.append(
			`const {enabled: phragonDebugConfigEnabled = false, ... phragonDebugConfig} = ${cJs.imp(
				"@phragon/server/config",
				"config"
			)}("debug", {namespacePrefix: "phragon:"});`
		)
		.group("if(phragonDebugConfigEnabled)", "", () => {
			cJs.append(`${cJs.imp("@phragon/cli-debug", "debugConfig")}(phragonDebugConfig);`);
		})
		.group("else", "", () => {
			cJs.append(
				`${cJs.imp("@phragon/cli-debug", "debugSetNamespacePrefix")}(phragonDebugConfig.namespacePrefix);`
			);
		});

	// create error function
	cJs.nl().group("function error(err)", "", () => {
		cJs.append(['console.error("server failure", err);', "process.exit(1);"]);
	});

	// create loadOptions function
	if (isClusterMode) {
		cJs.nl().group(`function loadOptions(options, id)`, "", () => {
			cJs.append("if(id == null) return options;");
			cJs.append('return require("./srv/server-" + id + ".js").load(options);');
		});
	}

	function create(options: {
		bootstrap: PhragonPlugin.ConfigType<"bootstrap", PhragonPlugin.Handler>[];
		isPage?: boolean;
		renderHTMLDriver?: string | null;
		router?: PhragonPlugin.Handler | null;
	}) {
		const { bootstrap, isPage = false, router, renderHTMLDriver = null } = options;
		cJs.append(`const registrar = new ${srv}.BootManager();`);

		// load ./server-page
		if (isPage) {
			const load = cJs.imp("./loadable");
			const loadable = `${render?.modulePath}/loadable`;
			let args = `__BUNDLE__ + "/server-page/server-page.js"`;
			if (loadable) {
				args += `, ${cJs.tool.esc(loadable)}`;
			}
			cJs.append(`registrar.bootstrap((phragon) => ${load}(phragon, ${args}));`);
		}

		cJs.append(`registrar.bootstrap((phragon) => import("./lexicon-server").then(l => l.default(phragon)));`);

		// load factory import options

		factory.middleware.forEach((mwr) => {
			let {
				middleware: { path, importer, options },
			} = mwr;
			const func = cJs.imp(createRelativePath(path, ".phragon"), importer);
			if (isAcs(mwr.middleware, ["middleware", func])) {
				cJs.append(`registrar.middleware(${func}${options ? `, ${cJs.tool.esc(options)}` : ""});`);
			}
		});

		factory.publicPath.forEach((item) => {
			publicPath.push(createRelativePath(item.path));
		});

		factory.service.forEach((item) => register("service", item.service, item.name));
		factory.controller.forEach((item) => register("controller", item.controller, item.name));
		factory.responder.forEach((item) => register("responder", item.responder, item.name));
		factory.extraMiddleware.forEach((item) => register("extraMiddleware", item.middleware, item.name));
		factory.cmd.forEach((item) => register("cmd", item.cmd, item.name));

		bootstrap.forEach((node) => {
			let { path, importer } = node.bootstrap;
			const func = cJs.imp(createRelativePath(path, ".phragon"), importer);
			if (isAcs(node.bootstrap, ["bootstrap", func])) {
				cJs.append(`registrar.bootstrap(${func});`);
			}
		});

		cJs.group("const options =", ";", (t) => {
			cJs.append([
				"mode: __ENV__,",
				"registrar,",
				`buildId: __DEV__ ? null : ${t.esc(buildId)},`,
				`buildVersion: ${t.esc(buildVersion)},`,
				`renderHTMLDriver: ${renderHTMLDriver === null ? "null" : t.esc(renderHTMLDriver)},`,
				`publicPath: ${t.esc(publicPath)},`,
			]);
			if (!isClusterMode) {
				cJs.append(`ssr: ${ssr ? "IS_SSR" : "false"},`);
			}
			if (router) {
				const { path, importer } = router;
				const func = cJs.imp(createRelativePath(path, ".phragon"), importer);
				cJs.append(`router: ${func},`);
			}
		});

		cJs.nl()
			.group("if(isCmd)", "", () => {
				cJs.append(`${srv}.cmdServer(options).catch(error);`);
			})
			.group("else", "", () => {
				if (isClusterMode) {
					cJs.group("if(__PROD__ && !isPrimaryCluster())", "", () => {
						cJs.append(`${srv}.childProcess(loadOptions(options, clusters[clusterId])).catch(error);`);
					}).group("else", "", () => {
						cJs.append(`${srv}.server(loadOptions(options, clusters[clusterId])).catch(error);`);
					});
				} else {
					cJs.group("function isCron()", "", () => {
						const name = cJs.get("workerData");
						cJs.append(`return ${name} && ${name}.appMode === "cron";`);
					});
					cJs.group(`if(! ${cJs.get("isMainThread")} && isCron())`, "", () => {
						cJs.append(`${srv}.cronServer({ ... options, cronMode: "worker" }).catch(error);`);
					});
					cJs.group("else if(__DEV__)", "", () => {
						const pingPong = cJs.imp("./ping-pong.js");
						cJs.append(`${srv}.server(options).then(${pingPong}).catch(error);`);
					});
					cJs.group("else", "", () => {
						cJs.append('if(process.argv.includes("--cron")) { options.cronMode = "service"; }');
						cJs.append('else if(process.argv.includes("--no-cron")) { options.cronMode = "disabled"; }');
						cJs.append(`${srv}.server(options).catch(error);`);
					});
				}
			});
	}

	cJs.nl();

	if (isClusterMode) {
		// remove last boostrap (use boostrap from cluster)
		const bootstrap = factory.bootstrap.slice();
		if (bootstrap.length) {
			const last = bootstrap[bootstrap.length - 1];
			if (last.__plugin.root && factory.renderPlugin?.root) {
				bootstrap.pop();
			}
		}

		cJs.group(`if(!isCmd && __PROD__ && isPrimaryCluster())`, "", (tool) => {
			const conf = clusterList.map((item) => ({
				id: item.id,
				mid: item.mid,
				mode: item.mode,
				count: item.count,
				env: item.env,
			}));
			cJs.append(`${srv}.masterProcess(${tool.esc(conf)});`);
		}).group("else", "", () => {
			create({ bootstrap });
		});
	} else {
		if (ssr) {
			await writeLoadable();
		}
		create({
			bootstrap: factory.bootstrap,
			isPage: ssr,
			renderHTMLDriver: render && page != null ? render.modulePath : null,
			router: factory.route,
		});
	}

	// write main server
	await writeBundleFile(
		"./server.js",
		`const NODE_ENV = String.fromCharCode(78) + "ODE_ENV";
if(!process.env[NODE_ENV]) {
	process.env[NODE_ENV] = __ENV__;
}

${cJs.toJS("import")}`
	);

	// ping-pong file
	await writeDevPingPong();

	// write cmd file
	await writeBundleFile(
		"cmd.js",
		`if(process.argv[1] === __filename) {
	process.env.APP_MODE = "cmd";
	require("./server");
} else {
	throw new Error("Access denied");
}`
	);

	// make cluster files
	if (clusterList.length > 0) {
		await createCwdDirectoryIfNotExists(".phragon/srv");
		for (let cl of clusterList) {
			const { ssr, mid, mode, publicPath, bootstrap, route, render: isRender, page } = cl;
			const cJs = new CmpJS();

			if (mode === "app" && ssr) {
				await writeLoadable();
			}

			cJs.group("export function load(options)", "", (t) => {
				cJs.append(`options.process = ${t.esc({ mid, id: cl.id })};`);

				if (render && isRender && page != null) {
					cJs.append(`options.renderHTMLDriver = ${t.esc(render.modulePath)};`);
				}

				if (publicPath) {
					cJs.append(`options.publicPath.unshift(${t.esc(publicPath)});`);
				}

				if (bootstrap) {
					let { path, importer } = bootstrap;
					const func = cJs.imp(createRelativePath(path, ".phragon/srv"), importer);
					if (isAcs(bootstrap, ["bootstrap", func], false)) {
						cJs.append(`options.registrar.prepend(r => r.bootstrap(${func}));`);
					}
				}

				let isSSR = mode === "app" ? ssr : false;
				if (mode === "app") {
					if (ssr) {
						const load = cJs.imp("../loadable");
						const loadable = `${render?.modulePath}/loadable`;
						let args = `__BUNDLE__ .concat("/server-page-${mid}/server-page.js")`;
						if (loadable) {
							args += `, ${t.esc(loadable)}`;
						}
						cJs.append(
							`options.registrar.prepend(r => r.bootstrap((phragon) => ${load}(phragon, ${args})));`
						);
					} else {
						cJs.append(`global[String.fromCharCode(95,95,83,83,82,95,95)] = false;`);
					}
				} else if (mode === "cron") {
					cJs.append('options.cronMode = "service";');
				}

				if (route) {
					const { path, importer } = route;
					const func = cJs.imp(createRelativePath(path, ".phragon/srv"), importer);
					cJs.append(`options.router = ${func};`);
				}

				cJs.append(`options.ssr = ${isSSR ? "__SSR__" : "false"};`);
				cJs.append("return options;");
			});

			await writeBundleFile(`./srv/server-${mid}.js`, cJs.toJS("import"));
		}
	}
}

export async function buildServerDaemon(factory: PhragonPlugin.Factory) {
	await writeJsonFile(buildPath("phragon-daemon.json"), factory.daemon || {});
}
