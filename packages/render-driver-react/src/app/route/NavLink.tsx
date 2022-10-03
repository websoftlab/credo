import React from "react";
import { __isDev__ } from "@phragon/utils";
import { useNavigateIsActive } from "./hooks";
import { Link } from "./Link";
import type { ReactNode, CSSProperties, ElementType, ReactElement } from "react";
import type { PolymorphicRef } from "./types";
import type { LinkProps } from "./Link";

export type NavLinkProps<C extends ElementType> = Omit<LinkProps<C>, "className" | "style" | "children"> & {
	children?: ReactNode | ((props: { isActive: boolean }) => ReactNode);
	className?: string | ((props: { isActive: boolean }) => string | undefined);
	style?: CSSProperties | ((props: { isActive: boolean }) => CSSProperties);
	caseSensitive?: boolean;
	end?: boolean;
};

type NavLinkComponent = (<C extends ElementType = "a">(props: NavLinkProps<C>) => ReactElement | null) & {
	displayName?: string | undefined;
};

/**
 * A <Link> wrapper that knows if it's "active" or not.
 *
 * @see https://reactrouter.com/docs/en/v6/components/nav-link
 */
export const NavLink: NavLinkComponent = React.forwardRef(function NavLinkWithRef<C extends ElementType = "a">(
	{
		"aria-current": ariaCurrentProp = "page" as never,
		caseSensitive,
		end,
		className: classNameProp = "",
		style: styleProp,
		to,
		children,
		...rest
	}: NavLinkProps<C>,
	ref?: PolymorphicRef<C>
) {
	const isActive = useNavigateIsActive(to, { caseSensitive, end });
	const style = typeof styleProp === "function" ? styleProp({ isActive }) : styleProp;
	const ariaCurrent = isActive ? ariaCurrentProp : undefined;

	let className: string | undefined;
	if (typeof classNameProp === "function") {
		className = classNameProp({ isActive });
	} else {
		className = classNameProp;
		if (isActive) {
			className = `${className ? `${className} ` : ""}active`;
		}
	}

	return (
		<Link {...rest} aria-current={ariaCurrent} className={className} ref={ref} style={style} to={to}>
			{typeof children === "function" ? children({ isActive }) : children}
		</Link>
	);
});

if (__isDev__()) {
	NavLink.displayName = "NavLink";
}
