import React from "react";
import {Router} from "react-router-dom";
import {observe} from "mobx";
import {Head} from "../head";
import {ApiContext, Loader} from "../app";
import type {MutableRefObject, ElementType} from "react";
import type {Action, History, Location} from "history";
import type {Lambda} from "mobx";
import type {API} from "@credo-js/responder-page";
import type {OnAppMountHook, OnLocationChangeHook, OnPageHook, OnPageTitleHook} from "../app";

const initialId: symbol = Symbol();

function hookPageTitle(api: API.ApiInterface<ElementType>, pid: MutableRefObject<string>) {
	const {title} = api.page;
	if(pid.current !== title) {
		pid.current = title;
		const event: OnPageTitleHook = {
			title,
			mutate: true,
		};
		api.emit<OnPageTitleHook>("onPageTitle", event);
		if(event.mutate) {
			document.title = event.title;
		}
	}
}

export default function App(props: {
	api: API.ApiInterface<ElementType>,
	history: History,
}) {

	const {api, history} = props;
	const {app, page} = api;
	const pid = React.useRef<symbol>(initialId);
	const pgt = React.useRef<string>("");

	// page mount & error
	const onMount = () => {
		if(pid.current !== page.id) {
			pid.current = page.id;
			const {error, response} = page;
			if(error) {
				api.emit<OnPageHook>("onPageError", {page, history});
			} else if(response) {
				api.emit<OnPageHook>("onPageMount", {page, history});
			}
		}
	};

	React.useEffect(() => {
		const unmount: Lambda[] = [];

		// fire mount hook
		api.emit<OnAppMountHook>("onMount", {app});
		hookPageTitle(api, pgt);

		// change page title
		unmount.push(observe(page, "title", () => {
			hookPageTitle(api, pgt);
		}));

		// history change
		unmount.push(history.listen((location: Location, action: Action) => {
			api.emit<OnLocationChangeHook>("onLocationChange", {location, action});
		}));

		return () => {
			unmount.forEach(func => func());
		}
	}, []);

	return (
		<ApiContext.Provider value={api}>
			<Head>
				<Router history={history}>
					<Loader page={page} onMount={onMount} />
				</Router>
			</Head>
		</ApiContext.Provider>
	);
}
