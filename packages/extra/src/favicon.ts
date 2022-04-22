import type { OnPageHTMLBeforeRenderHook, HtmlDocument } from "@credo-js/responder-page";
import type { CredoJSGlobal } from "@credo-js/server";
import type { CredoExtraFavicon } from "./types";

function prefix(value: string) {
	value = String(value);
	if (!value.startsWith("/") && !/https?:/.test(value)) {
		value = `/${value}`;
	}
	return value;
}

function hook(document: HtmlDocument, favicon: CredoExtraFavicon) {
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
	const { favicon } = credo.config("config");

	// favicon properties
	if (favicon) {
		hook(document, favicon);
	}
}

export function subscribeFaviconHook(credo: CredoJSGlobal) {
	if (credo.isApp() && credo.renderHTMLDriver != null) {
		const { favicon } = credo.config("config");
		if (favicon) {
			credo.hooks.subscribe<OnPageHTMLBeforeRenderHook>("onPageHTMLBeforeRender", (event) => {
				hook(event.document, favicon);
			});
		}
	}
}
