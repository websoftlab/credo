import type { ReactNode } from "react";
import type { HeadTagWithKey } from "@phragon/html-head";
import { useLayoutEffect, createElement, Fragment } from "react";
import { Provider, useHeadContext } from "./context";
import { HeadManager, clearHeadDOMTags } from "@phragon/html-head";
import { __isWeb__ } from "@phragon-util/global-var";

export interface HeadProps {
	children: ReactNode | ReactNode[];
	server?: boolean;
	headTags?: HeadTagWithKey[];
}

export default function Head(props: HeadProps) {
	const { children, server = false, headTags = [] } = props;
	const parent = useHeadContext();
	const ctx: HeadManager = parent || new HeadManager(server, headTags);

	if (__isWeb__()) {
		useLayoutEffect(() => {
			if (!parent) {
				clearHeadDOMTags();
			}
		}, []);
	}

	if (parent) {
		return createElement(Fragment, { children });
	}

	// set status - false for all meta
	// but without rerender
	ctx.reset();

	return createElement(Provider, { value: ctx, children });
}
