import axios from "axios";
import type {AxiosInstance} from "axios";
import type {HttpJsonServiceOptions} from "../types";

export default function createHttpJsonService(options: HttpJsonServiceOptions): AxiosInstance {
	const http = axios.create({
		validateStatus: () => true,
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		},
	});

	let {
		getQueryId,
		host,
		protocol = "http",
	} = options;

	const queryId = encodeURIComponent(getQueryId || "query");

	http.interceptors.request.use((conf) => {
		const {isPage = false, ... config} = conf;
		let {url = "", baseURL} = config;

		if(isPage) {
			url = `${url}${url.includes('?') ? '&' : '?'}t=${queryId}-${Date.now()}`;
		}

		if(host) {
			if(protocol !== "https") {
				protocol = "http";
			}
			baseURL = `${protocol}://${host}`;
			if(!url.startsWith("/")) {
				url = `/${url}`;
			}
		}

		config.baseURL = baseURL;
		config.url = url;

		return config;
	});

	return http;
}