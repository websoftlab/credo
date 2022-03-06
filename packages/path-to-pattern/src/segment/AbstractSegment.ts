import Plain from "./Plain";
import Value from "./Value";
import Values from "./Values";
import List from "./List";

const SEGMENT_ID = Symbol();

export abstract class AbstractSegment {
	[SEGMENT_ID]: string;

	constructor(type: string) {
		this[SEGMENT_ID] = type;
	}

	abstract compare(item: string | undefined, index: number, all: string[]): false | { offset: number, data?: any };
	abstract replace(data: any, encode?: ((str: string) => string)): string;

	static isSegment(value: any): value is AbstractSegment { return value && typeof value[SEGMENT_ID] === "string"; }
	static isPlain(value: any): value is Plain { return value && value[SEGMENT_ID] === "plain"; }
	static isValue(value: any): value is Value { return value && value[SEGMENT_ID] === "value"; }
	static isValues(value: any): value is Values { return value && value[SEGMENT_ID] === "values"; }
	static isList(value: any): value is List { return value && value[SEGMENT_ID] === "list"; }
}