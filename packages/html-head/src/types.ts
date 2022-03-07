
export type HeadTagName = "title" | "style" | "meta" | "link" | "base" | "charset" | "viewport";

export type HeadTag<Props = any> = {
	type: HeadTagName;
	tagName: string;
	props: Props;
	singleton: boolean;
}
