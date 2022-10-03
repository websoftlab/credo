import React from "react";
import { __isDev__ } from "@phragon/utils";
import { useHtmlText } from "./hooks";
import type { ElementType, ReactElement } from "react";
import type { PolymorphicComponentPropWithRef, PolymorphicRef } from "./types";

export type HtmlTextProps<C extends ElementType> = PolymorphicComponentPropWithRef<C, { children: string }>;

type HtmlTextComponent = (<C extends ElementType = "div">(props: HtmlTextProps<C>) => ReactElement | null) & {
	displayName?: string | undefined;
};

export const HtmlText: HtmlTextComponent = React.forwardRef(
	<C extends ElementType = "div">(
		{ as, dangerouslySetInnerHTML, children, ...rest }: HtmlTextProps<C>,
		ref?: PolymorphicRef<C>
	) => {
		const Component = as || "div";
		const refHtml = React.useRef<HTMLDivElement | null>(null);
		const refMerge = React.useCallback(
			(node: HTMLDivElement) => {
				refHtml.current = node;
				if (ref) {
					if (typeof ref === "function") {
						ref(node);
					} else {
						ref.current = node;
					}
				}
			},
			[ref]
		);

		useHtmlText(refHtml);

		return <Component {...rest} dangerouslySetInnerHTML={{ __html: children }} ref={refMerge} />;
	}
);

if (__isDev__()) {
	HtmlText.displayName = "HtmlText";
}
