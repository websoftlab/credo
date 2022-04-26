import type { HeadTag } from "@phragon/html-head";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export default function renderToString(headTags: HeadTag[], separator: string = "") {
	if (!headTags.length) {
		return "";
	}
	return headTags
		.map((headTag) => {
			const { tagName, props } = headTag;
			return renderToStaticMarkup(createElement(tagName, { ...props, "data-ssr": "head" }));
		})
		.join(separator);
}
