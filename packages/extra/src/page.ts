import { HtmlNode } from "@phragon/responder-page";
import type { OnPageHTMLBeforeRenderHook, HtmlDocument } from "@phragon/responder-page";
import type { PhragonJSGlobal } from "@phragon/server";
import type { PhragonExtraPageData } from "./types";

function normalize<T>(value?: T | T[]): T[] {
	if (value == null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	} else {
		return [value];
	}
}

function hook(document: HtmlDocument, pageData: PhragonExtraPageData) {
	const {
		charset,
		doctype,
		autoMetaTags,
		noscriptBanner,
		viewport,
		htmlAttributes,
		injectHead: { node, evalScript, script, link, meta, style } = {},
		injectBody: { node: bodyNode, evalScript: bodyEvalScript, script: bodyScript } = {},
	} = pageData;

	if (charset) {
		document.charset = charset;
	}
	if (doctype) {
		document.doctype = doctype;
	}
	if (autoMetaTags && Array.isArray(autoMetaTags)) {
		document.autoMetaTags = autoMetaTags;
	}
	if (noscriptBanner) {
		document.noscriptBanner = noscriptBanner;
	}
	if (typeof viewport === "string" || viewport === null) {
		document.viewport = viewport;
	}
	if (htmlAttributes) {
		document.htmlAttributes = htmlAttributes;
	}

	// head
	normalize(meta).forEach(({ type = "name", value, content }) => {
		document.injectHeadMeta(type, value, content);
	});
	normalize(link).forEach((link) => {
		document.injectHeadScript(typeof link === "string" ? link : link.href);
	});
	normalize(script).forEach((script) => {
		document.injectHeadScript(script);
	});
	normalize(evalScript).forEach((script) => {
		if (typeof script === "string") {
			document.injectHeadEvalScript(script);
		} else {
			document.injectHeadEvalScript(script.source, script.attributes);
		}
	});
	normalize(style).forEach((style) => {
		if (typeof style === "string") {
			document.injectHeadStyle(style);
		} else {
			document.injectHeadStyle(style.source);
		}
	});
	normalize(node).forEach((node) => {
		document.injectHead(typeof node === "string" ? node : new HtmlNode(node.name, node.attributes, node.html));
	});

	// body
	normalize(bodyEvalScript).forEach((script) => {
		if (typeof script === "string") {
			document.injectBodyEvalScript(script);
		} else {
			document.injectBodyEvalScript(script.source, script.attributes);
		}
	});
	normalize(bodyScript).forEach((script) => {
		document.injectBodyScript(script);
	});
	normalize(bodyNode).forEach((node) => {
		document.injectBody(typeof node === "string" ? node : new HtmlNode(node.name, node.attributes, node.html));
	});
}

export async function PageDataHook(event: OnPageHTMLBeforeRenderHook) {
	const { document } = event;
	const { pageData } = phragon.config("config");

	// favicon properties
	if (pageData) {
		hook(document, pageData);
	}
}

export function subscribePageDataHook(phragon: PhragonJSGlobal) {
	if (phragon.isApp() && phragon.renderHTMLDriver != null) {
		const { pageData } = phragon.config("config");
		if (pageData) {
			phragon.hooks.subscribe<OnPageHTMLBeforeRenderHook>("onPageHTMLBeforeRender", (event) => {
				hook(event.document, pageData);
			});
		}
	}
}
