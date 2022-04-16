import axios from "axios";
import type {AxiosInstance} from "axios";
import type {HttpJsonServiceOptions} from "./types";

export default function createHttpJsonService(options: HttpJsonServiceOptions): AxiosInstance {
	const http = axios.create({
		validateStatus: () => true,
	});

	let {
		host,
		protocol = "http",
	} = options;

	http.interceptors.request.use((config) => {
		let {url = "", baseURL} = config;

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