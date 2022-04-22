import createHeadComponent from "./createHeadComponent";
import type { HeadTagProps } from "./types";
import type { HTMLAttributeReferrerPolicy } from "react";

export type LinkProps = HeadTagProps<{
	href: string;
	hrefLang?: string | undefined;
	crossOrigin?: "anonymous" | "use-credentials" | "" | undefined;
	media?: string | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	rel?: string | undefined;
	sizes?: string | undefined;
	type?: string | undefined;
}>;

export default createHeadComponent<LinkProps>("link", {
	attributes: ["href", "hrefLang", "crossOrigin", "media", "referrerPolicy", "rel", "sizes", "type"],
});
