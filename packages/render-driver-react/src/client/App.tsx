import React from "react";
import { reaction } from "mobx";
import { Head } from "../head";
import { ApiContext, Loader, Router } from "../app";
import { getHistory } from "./navigator";
import type { MutableRefObject, ElementType } from "react";
import type { Lambda } from "mobx";
import type { API } from "@phragon/app";
import type {
	Navigator,
	OnAppMountHook,
	OnLocationChangeHook,
	OnPageMountHook,
	OnPageErrorHook,
	OnPageTitleHook,
} from "../app";

const initialId: symbol = Symbol();

function hookPageTitle(api: API.ApiInterface<ElementType>, pid: MutableRefObject<string>) {
	const { title } = api.page;
	if (pid.current !== title) {
		pid.current = title;
		const event: OnPageTitleHook = {
			title,
			mutate: true,
		};
		api.emit<OnPageTitleHook>("onPageTitle", event);
		if (event.mutate) {
			document.title = event.title;
		}
	}
}

export default function App(props: { api: API.ApiInterface<ElementType>; navigator: Navigator }) {
	const { api, navigator } = props;
	const { app, page } = api;
	const pid = React.useRef<symbol>(initialId);
	const pgt = React.useRef<string>("");
	const history = getHistory(navigator);

	const [state, setState] = React.useState({
		action: history.action,
		location: history.location,
	});

	React.useLayoutEffect(() => history.listen(setState), [history]);

	// page mount & error
	const onMount = () => {
		if (pid.current !== page.id) {
			pid.current = page.id;
			const { error } = page;
			if (error || page.response) {
				const { location, action } = getHistory(navigator);
				api.emit<OnPageMountHook>("onPageMount", { navigator, location, action, page, error });
				if (error) {
					api.emit<OnPageErrorHook>("onPageError", {
						code: page.code,
						message: page.errorMessage || app.translate("system.errors.unknown", "Unknown error"),
					});
				}
			}
		}
	};

	React.useEffect(() => {
		const unmount: Lambda[] = [];

		// fire mount hook
		api.emit<OnAppMountHook>("onMount", { app });
		hookPageTitle(api, pgt);

		// change page title
		unmount.push(
			reaction(
				() => page.title,
				() => {
					hookPageTitle(api, pgt);
				}
			)
		);

		// history change
		unmount.push(
			history.listen(({ location, action }) => {
				api.emit<OnLocationChangeHook>("onLocationChange", { navigator, location, action });
			})
		);

		return () => {
			unmount.forEach((func) => func());
		};
	}, [navigator, api, app, page]);

	return (
		<ApiContext.Provider value={api}>
			<Router location={state.location} navigationType={state.action} navigator={navigator}>
				<Head>
					<Loader page={page} onMount={onMount} />
				</Head>
			</Router>
		</ApiContext.Provider>
	);
}
