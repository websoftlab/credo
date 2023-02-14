import type { BuildConfigure } from "../../types";
import isWindows from "is-windows";
import { internalIp } from "../../utils";

function getUrl(host: string, port: string | number) {
	if (host === "0.0.0.0") {
		host = internalIp("v4") || "localhost";
	} else {
		host = internalIp("v6") || "localhost";
	}
	return `http://${host}:${port}/`;
}

export default function devServer(config: BuildConfigure) {
	const {
		devServerHost = isWindows() ? "127.0.0.1" : "0.0.0.0",
		devServerPort = 1277,
		proxyHost = isWindows() ? "127.0.0.1" : "0.0.0.0",
		proxyPort = 1278,
	} = config;
	return {
		url: getUrl(devServerHost, devServerPort),
		config: {
			host: devServerHost,
			port: devServerPort,
			historyApiFallback: true,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			devMiddleware: {
				index: false,
			},
			proxy: {
				context: () => true,
				target: getUrl(proxyHost, proxyPort),
			},
			// hot: true,
			// publicPath: '/',
			// overlay: false,
		},
	};
}
