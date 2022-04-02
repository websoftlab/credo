import type {Watch} from "../types";
import configure from "./configure";
import webpack from "webpack";

export default async function watcher(serve: Watch.Serve) {

	let abort: null | (() => Promise<void>);

	function disable(text: string = "") {
		serve.emitDebug(`[status disabled] ${text}`, "server-page");
	}

	serve.on("onAbort", async () => {
		if(abort) {
			await abort();
		}
	});

	serve.on("onBeforeStart", async (event) => {

		if(!event.force && !event.initial) {
			return;
		}

		if(abort) {
			await abort();
		}

		const {cluster, mode, ... rest} = event;
		const {options} = event.factory;
		if(mode !== "development" || !options.renderDriver) {
			return disable("Render driver not registered");
		}

		const ssr = cluster ? (cluster.mode === "app" ? cluster.ssr : false) : options.ssr;
		if(!ssr || !serve.ssr) {
			return disable("SSR set false");
		}

		const config = await configure({
			mode: "development",
			type: "server-page",
			isDevServer: false,
			cluster,
			debug: serve.progressLine ? (text: string, error?: boolean) => serve.emitDebug(text, "server-page", error) : undefined,
			... rest,
		});

		const {promise, update, close} = serve.createTrigger();

		const compiler = webpack(config);
		const watcher = compiler.watch({
			aggregateTimeout: 300,
			poll: undefined,
		}, (err, stats) => {

			if(err) {
				return update(err);
			}

			if(!stats) {
				return update(new Error("Unknown watch stats"));
			}

			serve.emitDebug("Server page compile completed...", "server-page");

			const info = stats.toJson();

			if(stats.hasErrors()) {
				const errors = info.errors;
				if(errors) {
					for(let error of errors) {
						serve.emitError(error as Error, "server-page error");
					}
				}
			}

			if(stats.hasWarnings()) {
				const warnings = info.warnings;
				if(warnings) {
					for(let error of warnings) {
						serve.emitError(error as Error, "server-page warning");
					}
				}
			}

			update();
		});

		abort = async () => {
			close();
			return new Promise<void>((resolve, reject) => {
				abort = null;
				watcher.close((err) => {
					if(err) {
						reject(err);
					} else {
						resolve();
					}
				});
			})
		};

		return promise;
	});
}