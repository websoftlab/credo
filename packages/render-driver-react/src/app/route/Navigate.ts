import type { To } from "history";
import { useContext, useEffect } from "react";
import { NavigationContext } from "./context";
import { warning } from "@phragon/utils";
import { useNavigate } from "./hooks";

export interface NavigateProps {
	to: To;
	replace?: boolean;
	state?: any;
	scroll?: boolean;
}

/**
 * Changes the current location.
 *
 * Note: This API is mostly useful in React.Component subclasses that are not
 * able to use hooks. In functional components, we recommend you use the
 * `useNavigate` hook instead.
 *
 * @see https://reactrouter.com/docs/en/v6/components/navigate
 */
export function Navigate({ to, replace, state, scroll }: NavigateProps): null {
	const navigate = useNavigate();
	warning(
		!useContext(NavigationContext).static,
		`<Navigate> must not be used on the initial render in a <StaticRouter>. ` +
			`This is a no-op, but you should modify your code so the <Navigate> is ` +
			`only ever rendered in response to some user interaction or state change.`
	);

	useEffect(() => {
		navigate(to, { replace, state, scroll });
	});

	return null;
}
