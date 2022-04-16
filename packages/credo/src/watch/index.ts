import devWatcher from "../webpack/devWatcher";
import webpackWatcher from "../webpack/watcher";
import {debugError, debugWatch} from "../debug";
import {clear} from "../utils";
import Board from "./Board";
import getTerminal from "./Terminal";
import prepareDebug from "./prepareDebug";
import WatchGlobal from "./WatchGlobal";
import WatchServe from "./WatchServe";
import type {Watch} from '../types';
import type {WatchEntry} from "./WatchGlobal";

const watchList: WatchEntry[] = [
	{path: "lexicon", type: "directory", required: true},
	{path: "config", type: "directory", required: true},
	{path: ".env", type: "file", required: false},
	{path: ".development.env", type: "file", required: false},
	{path: "credo.json", type: "file", required: true},
	{path: "tsconfig.json", type: "file", required: true},
	{path: "tsconfig-server.json", type: "file", required: false},
	{path: "tsconfig-client.json", type: "file", required: false},
	{path: "package.json", type: "file", required: true},
];

export default async function watch(opts: Watch.CMDOptions) {

	await clear("./dev");

	let board: Board | undefined;

	if( !process.stdout.isTTY ) {
		opts.noBoard = true;
	}

	if( !opts.noBoard ) {
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

	function errorHandler(error: Error) {
		if(board) {
			board.log(error);
		} else {
			debugError(error.stack || error.message);
		}
	}

	const serve = new WatchServe(opts);

	const watchGlobal = new WatchGlobal(() => {
		serve
			.restart()
			.catch(errorHandler);
	});

	watchList.forEach(item => watchGlobal.add(item));

	serve.on("error", errorHandler);
	serve.on("debug", (event) => {
		const {error, context, message} = event;
		if(board) {
			const prepare = prepareDebug(message, context, error);
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
			debugError("{yellow [%s]}", context, message);
		} else {
			debugWatch("{yellow [%s]}", context, message);
		}
	});

	// subscribe client
	await devWatcher(serve);

	// subscribe server-page
	await webpackWatcher(serve);

	try {
		await serve.start();
	} catch(err: any) {
		errorHandler(err);
	}

	watchGlobal.start();
}