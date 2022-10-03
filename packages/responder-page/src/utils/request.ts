import type { IncomingHttpHeaders } from "http";
import http from "http";

export interface RequestType {
	data: string;
	code: number;
	headers: IncomingHttpHeaders;
}

export default async function request(host: string, port: number, path: string): Promise<RequestType> {
	return new Promise<RequestType>((resolve, reject) => {
		http.request({ host, port, path }, (response) => {
			let data = "";
			response.on("data", (chunk) => {
				data += chunk;
			});
			response.on("end", () => {
				const code = response.statusCode || 500;
				if (String(code).startsWith("20")) {
					resolve({
						code,
						data,
						headers: response.headers,
					});
				} else {
					reject(new Error(`Load error. HTTP Status ${code}`));
				}
			});
			response.on("error", (error) => {
				reject(error);
			});
		}).end();
	});
}
