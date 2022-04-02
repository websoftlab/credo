import isWindows from "is-windows";
import devWatcher from "../webpack/devWatcher";
import compiler from "../compiler";
import rollupWatcher from "../rollup/watcher";
import webpackWatcher from "../webpack/watcher";
import createWatchServe from "./createWatchServe";
import {debugError, debugWatch} from "../debug";
import {watch as watchDirectory, watchFile, unwatchFile} from 'fs';
import {newError} from "@credo-js/cli-color";
import {clear, cwdPath, exists} from "../utils";
import Board from "./Board";
import getTerminal from "./Terminal";
import prepareDebug from "./prepareDebug";
import type {BuildOptions, CredoPlugin, Watch} from '../types';

function getConfigCluster(id: string | undefined, options: CredoPlugin.RootOptions) {
	const {clusters} = options;
	if(clusters && clusters.length) {
		if(!id) {
			return clusters[0];
		}
		for(let cluster of clusters) {
			if(cluster.id === id) {
				return cluster;
			}
		}
		throw newError(`The {yellow %s} cluster not found!`, id);
	}
	return undefined;
}

async function configWatch(serve: Watch.Serve, cluster: string | undefined, conf: BuildOptions) {
	const configDirectory = cwdPath("config");
	const credoFile = cwdPath("credo.json");

	if(!await exists(configDirectory)) {
		throw new Error("Config directory not found");
	}

	if(!await exists(credoFile)) {
		throw newError("{cyan %s} file not found", "./credo.json");
	}

	function recompile() {
		if(!serve.initialized) {
			return;
		}

		compiler(conf.mode)
			.then((factory) => {
				conf.factory = factory;
				try {
					conf.cluster = getConfigCluster(cluster, factory.options);
				} catch(err) {
					return serve.abort(err as Error);
				}

				return serve.restart(conf);
			})
			.catch(err => {
				serve.emitError(err, "Restart failure (assembly failed)");
			});
	}

	const w1 = watchDirectory(configDirectory, { recursive: true }, recompile);
	watchFile(credoFile, recompile);

	serve.on("onAbort", () => {
		w1.close();
		unwatchFile(credoFile, recompile);
	});
}

export default async function watch(opts: Watch.CMDOptions) {

	await clear("./dev");

	let board: Board | undefined;

	if(process.stdout.isTTY) {
		const term = getTerminal();
		board = new Board(term);
		board.open();
		board.log("Run watch");

		process.on("exit", () => {
			term.cursorTo(0, 0);
			term.clearBottom();
			if(board && board.opened) {
				board.close();
			}
		});
	}

	const mode: "development" = "development";
	const {
		port = 1278,
		devPort = 1277,
		host = isWindows() ? '127.0.0.1' : '0.0.0.0',
		devHost = isWindows() ? '127.0.0.1' : '0.0.0.0',
		ssr = false,
		cluster,
	} = opts;

	const factory = await compiler(mode);
	const conf: BuildOptions = {mode, progressLine: board != null, factory, cluster: getConfigCluster(cluster, factory.options)};
	const serve = createWatchServe(conf, {host, port, devHost, devPort, ssr});

	serve.on("onError", (error) => {
		const {context} = error;
		if(board) {
			board.log(error, context ? context[0] : "");
		} else if(context) {
			debugError("{yellow [%s]}", context.join(", "), error.message, error.stack);
		} else {
			debugError(error.message, error.stack);
		}
	});

	serve.on("onDebug", (event) => {
		const {error, context, text} = event;
		if(board) {
			const prepare = prepareDebug(text, context, error);
			if(prepare.type == null) {
				board.log(prepare.text, prepare.context, prepare.error);
			} else if(prepare.progress !== null) {
				board.progress(prepare.type, prepare.progress, prepare.text);
			} else if(prepare.status !== null) {
				board.status(prepare.type, prepare.status, prepare.text);
			} else {
				board.message(prepare.type, prepare.text);
			}
		} else if(error) {
			debugError("{yellow [%s]}", context, text);
		} else {
			debugWatch("{yellow [%s]}", context, text);
		}
	});

	// subscribe watcher for config directory and ./credo.json file
	await configWatch(serve, cluster, conf);

	// subscribe client
	await devWatcher(serve, {
		host: devHost,
		port: devPort,
	});

	// subscribe server-page
	await webpackWatcher(serve);

	// subscribe server
	await rollupWatcher(serve);

	// run
	await serve.start();
}