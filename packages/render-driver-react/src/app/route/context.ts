import type { History, Location, To } from "history";
import { createContext } from "react";
import { Action as NavigationType } from "history";
import { __isDev__ } from "@phragon/utils";

/**
 * A Navigator is a "location changer"; it's how you get to different locations.
 *
 * Every history instance conforms to the Navigator interface, but the
 * distinction is useful primarily when it comes to the low-level <Router> API
 * where both the location and a navigator must be provided separately in order
 * to avoid "tearing" that may occur in a suspense-enabled app if the action
 * and/or location were to be read directly from the history instance.
 */
export type Navigator = {
	[key: symbol]: History;
	/**
	 * Navigates `n` entries backward/forward in the history stack relative to the
	 * current index. For example, a "back" navigation would use go(-1).
	 *
	 * @param delta - The delta in the stack index
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.go
	 */
	go(delta: number): void;
	/**
	 * Returns a valid href for the given `to` value that may be used as
	 * the value of an <a href> attribute.
	 *
	 * @param to - The destination URL
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.createHref
	 */
	createHref(to: To): string;
	/**
	 * Pushes a new location onto the history stack, increasing its length by one.
	 * If there were any entries in the stack after the current one, they are
	 * lost.
	 *
	 * @param to - The new URL
	 * @param options - Navigate options, scroll page after navigate and data to associate with the new location
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.push
	 */
	push(to: To, options?: NavigateOptions): void;
	/**
	 * Replaces the current location in the history stack with a new one.  The
	 * location that was replaced will no longer be available.
	 *
	 * @param to - The new URL
	 * @param options - Navigate options, scroll page after navigate and data to associate with the new location
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.replace
	 */
	replace(to: To, options?: NavigateOptions): void;
	/**
	 * Navigates to the previous entry in the stack. Identical to go(-1).
	 *
	 * Warning: if the current location is the first location in the stack, this
	 * will unload the current document.
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.back
	 */
	back(): void;
	/**
	 * Navigates to the next entry in the stack. Identical to go(1).
	 *
	 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.forward
	 */
	forward(): void;
};

export interface NavigateOptions {
	state?: any;
	scroll?: boolean;
}

interface NavigationContextObject {
	navigator: Navigator;
	static: boolean;
}

export const NavigationContext = createContext<NavigationContextObject>(null!);

if (__isDev__()) {
	NavigationContext.displayName = "Navigation";
}

interface LocationContextObject {
	location: Location;
	navigationType: NavigationType;
}

export const LocationContext = createContext<LocationContextObject>(null!);

if (__isDev__()) {
	LocationContext.displayName = "Location";
}
