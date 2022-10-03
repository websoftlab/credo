import React from "react";
import { __isDev__ } from "@phragon/utils";
import { useLinkClickHandler, useHref } from "./hooks";
import type { To } from "history";
import type { MouseEvent as ReactMouseEvent, ElementType, ReactElement } from "react";
import type { PolymorphicComponentPropWithRef, PolymorphicRef } from "./types";

export type LinkProps<C extends ElementType> = PolymorphicComponentPropWithRef<
	C,
	{
		reloadDocument?: boolean;
		replace?: boolean;
		state?: any;
		to: To;
		href?: never;
		scroll?: boolean;
	}
>;

type LinkComponent = (<C extends ElementType = "a">(props: LinkProps<C>) => ReactElement | null) & {
	displayName?: string | undefined;
};

/**
 * The public API for rendering a history-aware <a>.
 *
 * @see https://reactrouter.com/docs/en/v6/components/link
 */
export const Link: LinkComponent = React.forwardRef(function LinkWithRef<C extends ElementType = "a">(
	{ as, onClick, reloadDocument, replace, state, scroll = true, target, to, ...rest }: LinkProps<C>,
	ref?: PolymorphicRef<C>
) {
	const Component = as || "a";
	const href = useHref(to);
	const internalOnClick = useLinkClickHandler(to, { replace, state, scroll, target });

	function handleClick(event: ReactMouseEvent<HTMLAnchorElement, MouseEvent>) {
		if (onClick) onClick(event);
		if (!event.defaultPrevented) {
			if (!reloadDocument) {
				internalOnClick(event);
			} else if (event.currentTarget.tagName !== "A") {
				location.assign(href);
			}
		}
	}

	const linkProps: { href?: string; target?: string } = {};
	if (Component === "a") {
		linkProps.href = href;
		linkProps.target = target;
	}

	return (
		// eslint-disable-next-line jsx-a11y/anchor-has-content
		<Component {...rest} {...linkProps} onClick={handleClick} ref={ref} />
	);
});

if (__isDev__()) {
	Link.displayName = "Link";
}
