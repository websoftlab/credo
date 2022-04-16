import type {Watch} from "../types";
import type {Watching} from "webpack";
import configure from "./configure";
import webpack from "webpack";

export default async function watcher(serve: Watch.Serve) {

	let watch: Watching | null = null;
	let restart = false;
	let restartMore = false;

	function abort() {
		const abortWatcher = watch;
		if(abortWatcher) {
			watch = null;
			abortWatcher.close((err) => {
				if(err) {
					errorHandler(err);
				}
			});
		}
	}

	function errorHandler(error: Error) {
		serve.emit("error", error);
	}

	function debug(message: string) {
		serve.emit("debug", {message, context: "server-page"});
	}

	function disable(text: string = "") {
		debug(`[status disabled] ${text}`);
	}

	serve.on("onBeforeBuild", abort);
	serve.on("build", () => {
		abort();

		const factory = serve.factory;
		if(!factory) {
			return;
		}

		const {options} = factory;
		if(!options.renderDriver) {
			return disable("Render driver not registered");
		}

		const {cluster} = serve;
		const ssr = cluster ? (cluster.mode === "app" ? cluster.ssr : false) : options.ssr;
		if(!ssr || !serve.ssr) {
			return disable("SSR set false");
		}

		if(restart) {
			restartMore = true;
			return;
		}

		restart = true;

		function recursiveWatching(): Promise<void> {
			const factory = serve.factory;
			if(!factory) {
				throw new Error("Builder factory not defined");
			}
			return configure({
					mode: "development",
					type: "server-page",
					isDevServer: false,
					debug: serve.progress ? (text: string, error?: boolean) => serve.emit("debug", {message: text, context: "server-page", error}) : undefined,
					progressLine: serve.progress,
					factory,
					cluster,
				})
				.then(config => {
					return webpack(config).watch({
						aggregateTimeout: 300,
						poll: undefined,
					}, (err, stats) => {

						if(err) {
							return errorHandler(err);
						}

						if(!stats) {
							return errorHandler(new Error("Unknown watch stats"));
						}

						debug("Server page compile completed...");

						const info = stats.toJson();

						if(stats.hasErrors()) {
							const errors = info.errors;
							if(errors) {
								for(const error of errors) {
									errorHandler(error as Error);
								}
							}
						}

						if(stats.hasWarnings()) {
							const warnings = info.warnings;
							if(warnings) {
								for(const error of warnings) {
									errorHandler(error as Error);
								}
							}
						}
					});
				})
				.then(watching => {
					if(restartMore) {
						restartMore = false;
						abort();
						return recursiveWatching();
					} else {
						watch = watching;
					}
				});
		}

		recursiveWatching()
			.catch(errorHandler)
			.finally(() => {
				restart = false;
			});
	});
}