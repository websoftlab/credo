import { AbstractSegment } from "./AbstractSegment";

export default class Plain extends AbstractSegment {
	constructor(public segment: string) {
		super("plain");
	}
	compare(item: string | undefined): false | { offset: number; data?: any } {
		return item === this.segment ? { offset: 1 } : false;
	}
	replace() {
		return this.segment;
	}
}
