import React from "react";
import { __isDev__, invariant } from "@phragon/utils";
import { Action as NavigationType, parsePath } from "history";
import { NavigationContext, LocationContext } from "./context";
import type { Navigator } from "./context";
import type { ReactNode, ReactElement } from "react";
import type { Location } from "history";

export interface RouterProps {
	location: Partial<Location> | string;
	navigator: Navigator;
	navigationType?: NavigationType;
	children?: ReactNode;
	static?: boolean;
}

/**
 * Provides location context for the rest of the app.
 *
 * Note: You usually won't render a <Router> directly. Instead, you'll render a
 * router that is more specific to your environment such as a <BrowserRouter>
 * in web browsers or a <StaticRouter> for server rendering.
 *
 * @see https://reactrouter.com/docs/en/v6/routers/router
 */
export function Router({
	children = null,
	location: locationProp,
	navigationType = NavigationType.Pop,
	navigator,
	static: staticProp = false,
}: RouterProps): ReactElement | null {
	invariant(
		!React.useContext(NavigationContext),
		`You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`
	);

	const navigationContext = React.useMemo(() => ({ navigator, static: staticProp }), [navigator, staticProp]);

	if (typeof locationProp === "string") {
		locationProp = parsePath(locationProp);
	}

	let { pathname = "/", search = "", hash = "", state = null, key = "default" } = locationProp;

	const location = React.useMemo(() => {
		return {
			pathname,
			search,
			hash,
			state,
			key,
		};
	}, [pathname, search, hash, state, key]);

	return (
		<NavigationContext.Provider value={navigationContext}>
			<LocationContext.Provider children={children} value={{ location, navigationType }} />
		</NavigationContext.Provider>
	);
}

if (__isDev__()) {
	Router.displayName = "Router";
}
