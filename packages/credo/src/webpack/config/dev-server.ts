import isWindows from 'is-windows';
import type {BuildConfigure} from "../../types";

export default function devServer(config: BuildConfigure) {
	const {
		devServerHost = isWindows() ? '127.0.0.1' : '0.0.0.0',
		devServerPort = 8080,
	} = config;
	return {
		url: `http://${devServerHost}:${devServerPort}/`,
		config: {
			host: devServerHost,
			port: devServerPort,
			historyApiFallback: true,
			headers: {
				'Access-Control-Allow-Origin': '*'
			},
			proxy: {},
			// hot: true,
			// publicPath: '/',
			// overlay: false,
		},
	}
};