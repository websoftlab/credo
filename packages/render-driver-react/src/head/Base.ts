import createHeadComponent from "./createHeadComponent";
import type { HeadTagProps } from "./types";
import type { HTMLAttributeAnchorTarget } from "react";

export type BaseProps = HeadTagProps<{
	href: string;
	target?: HTMLAttributeAnchorTarget | undefined;
}>;

export default createHeadComponent<BaseProps>("base", {
	singleton: true,
	attributes: ["href", "target"],
});
