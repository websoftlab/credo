import type {AxiosRequestConfig} from "axios";

declare module "axios" {
	export interface AxiosRequestConfig {
		isPage?: boolean;
	}
}
