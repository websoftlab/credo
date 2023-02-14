import type { Watch } from "../types";
import configure from "./configure";
import webpack from "webpack";
import WebpackDevServer from "webpack-dev-server";
import { debug } from "../debug";

export default async function devWatcher(serve: Watch.Serve) {
	let server: WebpackDevServer | null = null;
	let abortWaiter: Promise<void> | null = null;
	let restart = false;
	let restartMore = false;

	function abort() {
		const abortServer = server;
		if (abortServer) {
			server = null;
			abortWaiter = abortServer
				.stop()
				.catch(errorHandler)
				.finally(() => {
					abortWaiter = null;
				});
		}
	}

	function errorHandler(error: Error) {
		serve.emit("error", error);
	}

	serve.on("onBeforeBuild", abort);
	serve.on("build", () => {
		abort();

		const { factory } = serve;
		if (!factory) {
			return;
		}

		const { cluster } = serve;
		if (cluster && cluster.mode !== "app") {
			return debug("Bundle mode is not an application, DevServer is ignored");
		}

		if (!factory.render) {
			return debug("Render driver not registered, DevServer is ignored");
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
			return Promise.resolve(abortWaiter)
				.then(() =>
					configure({
						mode: "development",
						type: "client",
						isDevServer: true,
						devServerHost: serve.devHost,
						devServerPort: String(serve.devPort),
						proxyHost: serve.host,
						proxyPort: String(serve.port),
						factory,
						cluster,
					})
				)
				.then((config) => {
					const { devServer, ...configRest } = config;
					const dev = {
						port: serve.devPort,
						...devServer,
						static: `./dev/client${cluster ? `-${cluster.mid}` : ""}`,
						hot: true,
					};

					server = new WebpackDevServer(dev, webpack(configRest));

					return server.start();
				})
				.then(() => {
					if (restartMore) {
						restartMore = false;
						abort();
						return recursiveWatching();
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
