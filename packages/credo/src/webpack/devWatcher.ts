import type {BuildConfigureOptions, BuildOptions, Watch} from "../types";
import configure from "./configure";
import isWindows from "is-windows";
import webpack from "webpack";
import WebpackDevServer from "webpack-dev-server";

export default async function devWatcher(serve: Watch.Serve, opts: {
	port?: number,
	host?: string
}) {
	let {port, host} = opts;
	let server: WebpackDevServer | null = null;

	if(!host) {
		host = isWindows() ? '127.0.0.1' : '0.0.0.0';
	}
	if(!port) {
		port = 1277;
	}

	async function abort() {
		if(server) {
			await server.stop();
			server = null;
		}
	}

	function disable(text: string = "") {
		serve.emitDebug(`[status disabled] ${text}`, "client");
	}

	async function watchMe(opts: BuildOptions) {
		await abort();

		const {cluster, mode, ... rest} = opts;
		if(mode !== "development") {
			return disable();
		}

		if(cluster) {
			if(cluster.mode !== "app") {
				return disable();
			}
		}

		if(!opts.factory.options.renderDriver) {
			return disable("Render driver not registered, ignore DevServer");
		}

		const config = await configure(<BuildConfigureOptions>{
			mode: "development",
			type: "client",
			isDevServer: true,
			devServerHost: host,
			devServerPort: String(port),
			cluster,
			debug: serve.progressLine ? (text: string, error?: boolean) => serve.emitDebug(text, "client", error) : undefined,
			... rest
		});

		const {devServer, ... configRest} = config;
		const dev = {
			port,
			... devServer,
			static: `./dev/client${cluster ? `-${cluster.mid}` : ""}`,
			hot: true,
		};

		const compiler = webpack(configRest);
		server = new WebpackDevServer(dev, compiler);

		try {
			await server.start();
		} catch(err) {
			server = null;
			throw err;
		}
	}

	serve.on("onAbort", abort);

	serve.on("onAfterStart", async (event) => {
		const {force, initial, ... rest} = event;
		if(!force && !initial) {
			return;
		}

		try {
			await abort();
			await watchMe(rest);
		} catch(err: any) {
			err.message = "DevServer watch failure. " + err.message;
			throw err;
		}
	});
}