import devWatcher from "../webpack/devWatcher";
import webpackWatcher from "../webpack/watcher";
import { debug } from "../debug";
import { clear } from "../utils";
import WatchGlobal from "./WatchGlobal";
import WatchServe from "./WatchServe";
import type { Watch } from "../types";
import type { WatchEntry } from "./WatchGlobal";

const watchList: WatchEntry[] = [
	{
		path: "lexicon",
		type: "directory",
		required: true,
		test(action) {
			return action !== "change";
		},
	},
	{ path: "config", type: "directory", required: true },
	{ path: ".env", type: "file", required: false },
	{ path: ".development.env", type: "file", required: false },
	{ path: "phragon.config.ts", type: "file", required: false },
	{ path: "phragon.config.js", type: "file", required: false },
	{ path: "tsconfig.json", type: "file", required: true },
	{ path: "tsconfig-server.json", type: "file", required: false },
	{ path: "tsconfig-client.json", type: "file", required: false },
	{ path: "package.json", type: "file", required: true },
];

export default async function watch(opts: Watch.CMDOptions) {
	await clear("./dev");

	function errorHandler(error: Error) {
		debug.error(error.stack || error.message);
	}

	const serve = new WatchServe(opts);

	const watchGlobal = new WatchGlobal(() => {
		serve.restart().catch(errorHandler);
	});

	watchList.forEach((item) => watchGlobal.add(item));

	serve.on("error", errorHandler);

	// subscribe client
	await devWatcher(serve);

	// subscribe server-page
	await webpackWatcher(serve);

	try {
		await serve.start();
	} catch (err) {
		debug.error(err);
	}

	watchGlobal.start();
}
