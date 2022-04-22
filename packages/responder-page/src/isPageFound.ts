import type { Render } from "./types";

export default function isPageFound(page: any): page is Render.PageFound {
	return page && typeof page.found === "boolean" ? page.found : "response" in page;
}
