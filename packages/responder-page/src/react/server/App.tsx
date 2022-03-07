import React from "react";
import {StaticRouter} from "react-router-dom";
import {Head} from "@credo-js/html-head/react/index";
import Loader from "../app/Loader";
import {ApiContext} from "../app/context";
import {CaptureContext} from "@credo-js/loadable/react";
import type {API} from "../../types";
import type {HeadTag} from "@credo-js/html-head";
import type {ElementType} from "react";

export default function App(props: {
	api: API.ApiInterface<ElementType>,
	context: any,
	location: string,
	headTags: HeadTag[],
	loadableContext: string[],
}) {
	const {api, context, location = "/", headTags, loadableContext} = props;
	const {page} = api;
	return (
		<ApiContext.Provider value={api}>
			<CaptureContext.Provider value={loadableContext}>
				<Head headTags={headTags}>
					<StaticRouter location={location} context={context}>
						<Loader page={page} onMount={() => {}} />
					</StaticRouter>
				</Head>
			</CaptureContext.Provider>
		</ApiContext.Provider>
	);
}
