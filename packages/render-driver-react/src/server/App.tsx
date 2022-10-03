import React from "react";
import StaticRouter from "./StaticRouter";
import { Head } from "../head";
import { ApiContext, Loader } from "../app";
import { CaptureContext } from "../loadable";
import type { API } from "@phragon/app";
import type { HeadTagWithKey } from "@phragon/html-head";
import type { ElementType } from "react";

export default function App(props: {
	api: API.ApiInterface<ElementType>;
	location: string;
	headTags: HeadTagWithKey[];
	loadableContext: string[];
}) {
	const { api, location = "/", headTags, loadableContext } = props;
	const { page } = api;
	return (
		<ApiContext.Provider value={api}>
			<CaptureContext.Provider value={loadableContext}>
				<StaticRouter location={location}>
					<Head server headTags={headTags}>
						<Loader page={page} onMount={() => {}} />
					</Head>
				</StaticRouter>
			</CaptureContext.Provider>
		</ApiContext.Provider>
	);
}
