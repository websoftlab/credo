export type ReplacerFunction = (name: string, value: any) => any;

export interface StringifyOptions {
	replacer?: ReplacerFunction | false;
	nullable?: boolean | string;
	plain?: boolean;
}
