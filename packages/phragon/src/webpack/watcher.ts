import type { Watch } from "../types";
import type { Watching } from "webpack";
import configure from "./configure";
import webpack from "webpack";
import { debug } from "../debug";

export default async function watcher(serve: Watch.Serve) {
	let watch: Watching | null = null;
	let restart = false;
	let restartMore = false;

	function abort() {
		const abortWatcher = watch;
		if (abortWatcher) {
			watch = null;
			abortWatcher.close((err) => {
				if (err) {
					errorHandler(err);
				}
			});
		}
	}

	function errorHandler(error: Error) {
		serve.emit("error", error);
	}

	serve.on("onBeforeBuild", abort);
	serve.on("build", () => {
		abort();

		const factory = serve.factory;
		if (!factory) {
			return;
		}

		if (!factory.render) {
			return debug("Render driver not registered");
		}

		const { cluster } = serve;
		const ssr = cluster ? (cluster.mode === "app" ? cluster.ssr : false) : factory.ssr;
		if (!ssr || !serve.ssr) {
			return debug("SSR set false");
		}

		if (restart) {
			restartMore = true;
			return;
		}

		restart = true;

		function recursiveWatching(): Promise<void> {
			const factory = serve.factory;
			if (!factory) {
				throw new Error("Builder factory not defined");
			}
			return configure({
				mode: "development",
				type: "server-page",
				isDevServer: false,
				factory,
				cluster,
			})
				.then((config) => {
					return webpack(config).watch(
						{
							aggregateTimeout: 300,
							poll: undefined,
						},
						(err, stats) => {
							if (err) {
								return errorHandler(err);
							}

							if (!stats) {
								return errorHandler(new Error("Unknown watch stats"));
							}

							debug("Server page compile completed...");

							const info = stats.toJson();

							if (stats.hasErrors()) {
								const errors = info.errors;
								if (errors) {
									for (const error of errors) {
										errorHandler(error as Error);
									}
								}
							}

							if (stats.hasWarnings()) {
								const warnings = info.warnings;
								if (warnings) {
									for (const error of warnings) {
										errorHandler(error as Error);
									}
								}
							}
						}
					);
				})
				.then((watching) => {
					if (restartMore) {
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
