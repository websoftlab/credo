
declare module "eastasianwidth" {
	export declare function slice(text: string, start?: number, end?: number): string;
	export declare function length(text: string): number;
	export declare function characterLength(text: string): number;
	export declare function eastAsianWidth(text: string): "F" | "H" | "W" | "Na" | "A" | "N";
	export = {
		slice,
		length,
		characterLength,
		eastAsianWidth,
	}
}