import type { ReactNode } from "react";
import type { Location, To } from "history";
import React from "react";
import { createPath, parsePath, Action } from "history";
import { Router } from "../app";

export interface StaticRouterProps {
	children: ReactNode;
	location: Partial<Location> | string;
}

function createThrow(name: string) {
	return function () {
		throw new Error(`You cannot use navigator.${name}() on the server because it is a stateless environment.`);
	};
}

export default function StaticRouter({ children, location: locationProp = "/" }: StaticRouterProps) {
	if (typeof locationProp === "string") {
		locationProp = parsePath(locationProp);
	}

	const location: Location = {
		pathname: locationProp.pathname || "/",
		search: locationProp.search || "",
		hash: locationProp.hash || "",
		state: locationProp.state || null,
		key: locationProp.key || "default",
	};

	const staticNavigator = {
		createHref(to: To) {
			return typeof to === "string" ? to : createPath(to);
		},
		push: createThrow("push"),
		replace: createThrow("replace"),
		go: createThrow("go"),
		back: createThrow("back"),
		forward: createThrow("forward"),
	};

	return (
		<Router
			children={children}
			location={location}
			navigationType={Action.Pop}
			navigator={staticNavigator}
			static={true}
		/>
	);
}
