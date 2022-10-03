export type HeadTagName = "title" | "style" | "meta" | "link" | "base" | "charset" | "viewport";

export interface HeadTag<Props = any> {
	type: HeadTagName;
	tagName: string;
	props: Props;
	singleton: boolean;
}

export interface HeadTagWithKey<Props = any> extends HeadTag<Props> {
	key: string;
	renderable: boolean;
}
