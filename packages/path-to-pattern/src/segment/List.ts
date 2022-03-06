import {AbstractSegment} from "./AbstractSegment";

export default class List extends AbstractSegment {
	constructor() {
		super("list");
	}
	compare(_: string | undefined, index: number, all: string[]): false | { offset: number; data?: any } {
		const data = {"*": [] as string[]};
		let offset = 0;
		for(let i = index; i < all.length; i++) {
			data["*"].push(all[i]);
			offset ++;
		}
		return {offset, data};
	}
	replace(data: any, encode?: ((str: string) => string)): string {
		let all = data["*"] || [];
		if(Array.isArray(all) && all.length > 0) {
			if(encode) {
				all = all.map(encode);
			}
			return all.join("/");
		}
		return "";
	}
}