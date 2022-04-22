export interface FaviconSize {
	size: string;
	href: string;
	rel?: string;
	type?: string;
	color?: string;
}

export interface CredoExtraFavicon {
	index?: string;
	manifest?: string;
	sizes?: FaviconSize[];
	properties?: Record<string, string>;
}
