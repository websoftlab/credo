import {watch} from "rollup";
import configure from "./configure";
import type {RollupBuild, RollupWatcherEvent} from "rollup";
import type {BuildConfigure, Watch} from "../types";

function isEventResult(event: any): event is {result: RollupBuild} {
	return event && event.result != null;
}

function onDefineOptionNoSSR(event: {name: string, option: any}, conf: BuildConfigure) {
	if(event.name === "config.define" && conf.type === "server") {
		event.option.__SSR__ = false;
	}
}

export default function watcher(serve: Watch.Serve) {

	let abort: null | (() => void);

	serve.on("onAbort", () => {
		if(abort) {
			abort();
		}
	});

	serve.on("onBeforeStart", async (event) => {

		const {mode, force, initial, ... rest} = event;
		if(!force && !initial) {
			return;
		}

		if(abort) {
			abort();
		}

		if(mode !== "development") {
			return;
		}

		if(!serve.ssr) {
			event.factory.on("onOptions", onDefineOptionNoSSR);
		}

		const config = await configure({
			mode: "development",
			type: "server",
			debug: serve.progressLine ? (text: string, error?: boolean) => serve.emitDebug(text, "server", error) : undefined,
			... rest
		});

		let watcher = watch({
			... config,
			watch: {
				// todo add watch options
			}
		});

		const {promise, update, close} = serve.createTrigger();

		let lastError = false;
		let watched = true;

		const listener = (event: RollupWatcherEvent) => {
			if(event.code === "BUNDLE_START") {
				lastError = false;
			} else if(event.code === "ERROR") {
				lastError = true;
				update(event.error as Error);
			} else if(event.code === "BUNDLE_END" && !lastError) {
				update();
			}

			// This will make sure that bundles are properly closed after each run
			if (watched && isEventResult(event)) {
				event.result.close().catch(err => {
					serve.emitError(err, "server failure");
				});
			}
		};

		abort = () => {
			close();
			watched = false;
			try {
				watcher.off("event", listener);
				watcher.close();
			} finally {
				abort = null;
			}
		};

		watcher.on("event", listener);

		return promise;
	});
}
