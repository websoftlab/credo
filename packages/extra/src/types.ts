export interface FaviconSize {
	size: string;
	href: string;
	rel?: string;
	type?: string;
	color?: string;
}

export interface PhragonExtraFavicon {
	index?: string;
	manifest?: string;
	sizes?: FaviconSize[];
	properties?: Record<string, string>;
}

type Attr = Record<string, string | number | boolean>;

export type HTMLScriptElement = string;

export interface HTMLMetaElement {
	type?: "name" | "property";
	value: string;
	content: string;
}

export type HTMTLEvalScriptElement = string | { source: string; attributes?: Attr };

export type HTMLLinkElement = string | { href: string };

export type HTMLStyleElement = string | { source: string };

export interface HTMLNodeElement {
	name: string;
	attributes?: Attr;
	html?: string;
}

export interface PhragonExtraPageData {
	doctype?: string;
	charset?: string;
	viewport?: string;
	htmlAttributes?: Record<string, string>;
	noscriptBanner?: string;
	autoMetaTags?: string[];
	injectHead?: {
		node?: string | HTMLNodeElement;
		meta?: HTMLMetaElement | HTMLMetaElement[];
		link?: HTMLLinkElement | HTMLLinkElement[];
		style?: HTMLStyleElement | HTMLStyleElement[];
		script?: HTMLScriptElement | HTMLScriptElement[];
		evalScript?: HTMTLEvalScriptElement | HTMTLEvalScriptElement[];
	};
	injectBody?: {
		node?: string | HTMLNodeElement;
		script?: HTMLScriptElement | HTMLScriptElement[];
		evalScript?: HTMTLEvalScriptElement | HTMTLEvalScriptElement[];
	};
}
