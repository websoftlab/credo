import type { OnPageHTMLBeforeRenderHook, HtmlDocument } from "@phragon/responder-page";
import type { PhragonJSGlobal } from "@phragon/server";
import type { PhragonExtraFavicon } from "./types";

function prefix(value: string) {
	value = String(value);
	if (!value.startsWith("/") && !/https?:/.test(value)) {
		value = `/${value}`;
	}
	return value;
}

function hook(document: HtmlDocument, favicon: PhragonExtraFavicon) {
	const { sizes = [], properties = {}, index: indexFile, manifest } = favicon;

	Object.keys(properties).forEach((name) => {
		document.injectHeadMeta("name", name, properties[name]);
	});

	if (manifest) {
		document.injectHeadLink(manifest, { rel: "manifest" });
	}

	const index = prefix(indexFile || "/favicon.ico");
	if (index !== "/favicon.ico") {
		document.injectHeadLink(index, { rel: "icon" });
	}

	sizes.forEach((icon) => {
		const { type, size, color, href, rel } = icon;
		document.injectHeadLink(prefix(href), {
			type,
			sizes: size,
			rel,
			color,
		});
	});
}

export async function FaviconHook(event: OnPageHTMLBeforeRenderHook) {
	const { document } = event;
	const { favicon } = phragon.config("config");

	// favicon properties
	if (favicon) {
		hook(document, favicon);
	}
}

export function subscribeFaviconHook(phragon: PhragonJSGlobal) {
	if (phragon.isApp() && phragon.renderHTMLDriver != null) {
		const { favicon } = phragon.config("config");
		if (favicon) {
			phragon.hooks.subscribe<OnPageHTMLBeforeRenderHook>("onPageHTMLBeforeRender", (event) => {
				hook(event.document, favicon);
			});
		}
	}
}
