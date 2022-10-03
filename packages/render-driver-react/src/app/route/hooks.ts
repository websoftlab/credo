import type { HTMLAttributeAnchorTarget, MouseEvent as ReactMouseEvent } from "react";
import type { OnPageAnchorClickHook, OnPageClickHook } from "../types";
import type { ElementType, RefObject } from "react";
import type { To, Path, Location } from "history";
import type { API } from "@phragon/app";
import type { Action as NavigationType } from "history";
import type { Navigator } from "./context";
import { createPath, parsePath } from "history";
import { invariant, warning } from "@phragon/utils";
import { useMemo, useCallback, useEffect, useRef, useContext } from "react";
import resolvePath from "./resolvePath";
import { createEvent } from "../utils";
import { useApiContext } from "../context";
import { useIsomorphicLayoutEffect } from "../utils";
import { LocationContext, NavigationContext } from "./context";

type LinkCache = {
	handler(e: MouseEvent): void;
	url: string;
	navigator: Navigator;
};

type EventHook =
	| Omit<OnPageAnchorClickHook, "defaultPrevented" | "preventDefault">
	| Omit<OnPageClickHook, "defaultPrevented" | "preventDefault">;

/**
 * The interface for the navigate() function returned from useNavigate().
 */
export interface RouteNavigateFunction {
	(to: To, options?: RouteNavigateOptions): void;
}

export interface RouteNavigateOptions {
	replace?: boolean;
	state?: any;
	scroll?: boolean;
}

function isModifiedEvent(event: ReactMouseEvent) {
	return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

const LINK_CACHE = Symbol("link.cache");

function onClickEmit(api: API.ApiInterface<ElementType>, eventHook: EventHook) {
	const event = createEvent(eventHook);
	if ("element" in event && event.element) {
		api.emit<OnPageAnchorClickHook>("onPageAnchorClick", event);
	} else {
		api.emit<OnPageClickHook>("onPageClick", event);
	}
	return event;
}

////////////////////////////////////////////////////////////////////////////////
// HOOKS
////////////////////////////////////////////////////////////////////////////////

/**
 * Returns the full href for the given "to" value. This is useful for building
 * custom links that are also accessible and preserve right-click behavior.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-href
 */
export function useHref(to: To): string {
	return useNavigator().createHref(useResolvedPath(to));
}

/**
 * Resolves the pathname of the given `to` value against the current location.
 *
 * @see https://reactrouter.com/docs/en/v6/api#useresolvedpath
 */
export function useResolvedPath(to: To): Path {
	let { pathname: locationPathname } = useLocation();
	return useMemo(() => resolveTo(to, locationPathname), [to, locationPathname]);
}

export interface NavigateIsActiveOptions {
	caseSensitive?: boolean;
	end?: boolean;
}

export function useNavigateIsActive(to: To, options: NavigateIsActiveOptions = {}) {
	const { caseSensitive = false, end = false } = options;

	let locationPathname = useLocation().pathname;
	let toPathname = useResolvedPath(to).pathname;
	if (!caseSensitive) {
		locationPathname = locationPathname.toLowerCase();
		toPathname = toPathname.toLowerCase();
	}

	return (
		locationPathname === toPathname ||
		(!end && locationPathname.startsWith(toPathname) && locationPathname.charAt(toPathname.length) === "/")
	);
}

/**
 * Handles the click behavior for router `<Link>` components. This is useful if
 * you need to create custom `<Link>` components with the same click behavior we
 * use in our exported `<Link>`.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-link-click-handler
 */
export function useLinkClickHandler<E extends Element = HTMLAnchorElement>(
	to: To,
	{
		target,
		replace,
		state,
		scroll = true,
	}: {
		target?: HTMLAttributeAnchorTarget;
		replace?: boolean;
		state?: any;
		scroll?: boolean;
	} = {}
): (event: ReactMouseEvent<E, MouseEvent>) => void {
	const navigate = useNavigateCallback();
	const path = useResolvedPath(to);
	return useCallback(
		(event: ReactMouseEvent<E, MouseEvent>) => {
			if (
				event.button === 0 && // Ignore everything but left clicks
				(!target || target === "_self") && // Let browser handle "target=_blank" etc.
				!isModifiedEvent(event) // Ignore clicks with modifier keys
			) {
				event.preventDefault();
				navigate(
					to,
					{ replace, state },
					{ path, element: event.currentTarget, nativeEvent: event.nativeEvent }
				);
			}
		},
		[navigate, path, replace, state, target, to, scroll]
	);
}

function isTrue(value?: undefined | null | string) {
	if (value == null) {
		return false;
	}
	value = value.toLowerCase();
	return value === "yes" || value === "on" || value === "true" || value === "1";
}

function isFalse(value?: undefined | null | string) {
	if (value == null) {
		return false;
	}
	value = value.toLowerCase();
	return value === "no" || value === "off" || value === "false" || value === "0";
}

function initLink(api: API.ApiInterface<ElementType>, navigator: Navigator, element: HTMLAnchorElement) {
	let cache: LinkCache | undefined = (element as any)[LINK_CACHE];
	const url = createPath(element);

	if (cache) {
		if (cache.navigator === navigator && cache.url === url) {
			return;
		}
		element.removeEventListener("click", cache.handler, false);
		delete (element as any)[LINK_CACHE];
	}

	if (element.origin !== location.origin || (element.target !== "" && element.target !== "_self")) {
		return;
	}

	const handler = (e: MouseEvent) => {
		if (e.defaultPrevented) {
			return;
		}

		e.preventDefault();

		let state: any = {};
		let scroll = true;
		let replace: boolean;

		const attr = {
			state: element.getAttribute("data-state"),
			scroll: element.getAttribute("data-scroll"),
			replace: element.getAttribute("data-replace"),
		};

		if (isFalse(attr.scroll)) {
			scroll = false;
		}

		if (isTrue(attr.replace)) {
			replace = true;
		} else if (isFalse(attr.replace)) {
			replace = false;
		} else {
			replace = url === createPath(location);
		}

		try {
			if (attr.state) {
				state = JSON.parse(attr.state);
			}
		} catch (err) {}

		const event = onClickEmit(api, {
			to: url,
			replace,
			element,
			nativeEvent: e,
			state,
			scroll,
		});

		if (event.defaultPrevented) {
			return;
		}

		if (event.replace) {
			navigator.replace(url, { state: event.state, scroll: event.scroll });
		} else {
			navigator.push(url, { state: event.state, scroll: event.scroll });
		}
	};

	element.addEventListener("click", handler, false);
	(element as any)[LINK_CACHE] = {
		navigator,
		url,
		handler,
	} as LinkCache;
}

function initHtml(api: API.ApiInterface<ElementType>, navigator: Navigator, element: HTMLElement) {
	if (element.nodeType !== 1) {
		return;
	}
	if (element.nodeName === "A") {
		initLink(api, navigator, element as HTMLAnchorElement);
	} else if (element.firstChild) {
		const list = element.querySelectorAll("a[href]");
		for (let i = 0; i < list.length; i++) {
			initLink(api, navigator, list[i] as HTMLAnchorElement);
		}
	}
}

export function useHtmlText<T extends HTMLElement = HTMLElement>(ref: RefObject<T>) {
	const api = useApiContext();
	const navigator = useNavigator();
	useIsomorphicLayoutEffect(() => {
		if (ref.current) {
			initHtml(api, navigator, ref.current);
		}
	}, [navigator, ref.current]);
}

function resolveTo(toArg: To, locationPathname: string): Path {
	let to = typeof toArg === "string" ? parsePath(toArg) : toArg;
	let toPathname = toArg === "" || to.pathname === "" ? "/" : to.pathname;

	// If a pathname is explicitly provided in `to`, it should be relative to the
	// route context. This is explained in `Note on `<Link to>` values` in our
	// migration guide from v5 as a means of disambiguation between `to` values
	// that begin with `/` and those that do not. However, this is problematic for
	// `to` values that do not provide a pathname. `to` can simply be a search or
	// hash string, in which case we should assume that the navigation is relative
	// to the current location's pathname and *not* the route pathname.
	let from: string;
	if (toPathname == null) {
		from = locationPathname;
	} else {
		if (toPathname.startsWith("..")) {
			const toSegments = toPathname.split("/");

			// Each leading .. segment means "go up one route" instead of "go up one
			// URL segment".  This is a key difference from how <a href> works and a
			// major reason we call this a "to" value instead of a "href".
			while (toSegments[0] === "..") {
				toSegments.shift();
			}

			to.pathname = toSegments.join("/");
		}

		// resolve relative to the root / URL.
		from = "/";
	}

	const path = resolvePath(to, from);

	// Ensure the pathname has a trailing slash if the original to value had one.
	if (toPathname && toPathname !== "/" && toPathname.endsWith("/") && !path.pathname.endsWith("/")) {
		path.pathname += "/";
	}

	return path;
}

function useNavigateCallback() {
	const api = useApiContext();
	const location = useLocation();
	const navigator = useNavigator();

	const activeRef = useRef(false);
	useEffect(() => {
		activeRef.current = true;
	});

	return useCallback(
		(
			to: To,
			options: RouteNavigateOptions = {},
			eventOptions: null | {
				path: Path;
				element: Element | HTMLAnchorElement;
				nativeEvent: MouseEvent;
			} = null
		) => {
			warning(
				activeRef.current,
				`You should call navigate() in a React.useEffect(), not when your component is first rendered.`
			);

			if (!activeRef.current) return;

			let { replace, scroll = true, state = {} } = options;
			let path: Path;
			let hook: EventHook;

			if (eventOptions) {
				const { path: toPath, ...rest } = eventOptions;
				path = toPath;
				hook = {
					...rest,
					to: path,
					replace: replace || false,
					state,
					scroll,
				};
			} else {
				path = resolveTo(to, location.pathname);
				hook = {
					to: path,
					replace: replace || false,
					state,
					scroll,
				};
			}

			// If the URL hasn't changed, a regular <a> will do a replace instead of
			// a push, so do the same here.
			if (typeof replace !== "boolean") {
				hook.replace = createPath(location) === createPath(path);
			}

			const event = onClickEmit(api, hook);

			if (!event.defaultPrevented) {
				// prevent page scroll
				if (!event.scroll && api.hasHistoryScroll) {
					api.once("onPageHistoryScroll", (e) => {
						e.preventDefault();
					});
				}
				(event.replace ? navigator.replace : navigator.push)(event.to, event.state);
			}
		},
		[navigator, location]
	);
}

export function useNavigate(): RouteNavigateFunction {
	const navigate = useNavigateCallback();
	return useCallback((to: To, options: RouteNavigateOptions = {}) => navigate(to, options), [navigate]);
}

export function useNavigator() {
	const ctx = useContext(NavigationContext);
	invariant(ctx, `useNavigator() may be used only in the context of a <Router> component.`);
	return ctx.navigator;
}

/**
 * Returns the current location object, which represents the current URL in web
 * browsers.
 *
 * Note: If you're using this it may mean you're doing some of your own
 * "routing" in your app, and we'd like to know what your use case is. We may
 * be able to provide something higher-level to better suit your needs.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-location
 */
export function useLocation(): Location {
	const ctx = useContext(LocationContext);
	invariant(ctx, `useLocation() may be used only in the context of a <Router> component.`);
	return ctx.location;
}

/**
 * Returns the current navigation action which describes how the router came to
 * the current location, either by a pop, push, or replace on the history stack.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-navigation-type
 */
export function useNavigationType(): NavigationType {
	const ctx = useContext(LocationContext);
	invariant(ctx, `useNavigationType() may be used only in the context of a <Router> component.`);
	return ctx.navigationType;
}
