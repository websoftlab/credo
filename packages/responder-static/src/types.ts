
type ExcludeFunction = (path: string) => boolean;

export type ResponderStaticOptions = {
	root?: string | string[];
	exclude?: string | RegExp | ExcludeFunction | Array<string | RegExp | ExcludeFunction>;
	index?: boolean | string;
	maxAge?: number;
	gzip?: boolean;
	hidden?: boolean;
	format?: boolean;
	immutable?: boolean;
	brotli?: boolean;
	extensions?: string[];
}
