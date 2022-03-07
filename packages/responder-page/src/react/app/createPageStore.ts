import {load, loaded, component} from "@credo-js/loadable/react";
import PageStore from "../../app/PageStore";
import type {AxiosInstance} from "axios";

export default function createPageStore(http: AxiosInstance) {
	return new PageStore({
		http,
		loader: {load, loaded, component}
	});
}