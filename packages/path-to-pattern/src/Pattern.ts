import type {PatternInterface, MatchToPathOptions, MatchOptions} from "./types";
import {AbstractSegment} from "./segment/AbstractSegment";
import normalize from "./normalize";

const ID_KEY = Symbol();
const ID_SEGMENT = Symbol();

export default class Pattern<R = any> implements PatternInterface<R> {
	[ID_KEY] = true;
	[ID_SEGMENT]: AbstractSegment[] = [];

	constructor(public path: string, public keys: string[], public length: number = 1) {}

	add(segment: AbstractSegment) {
		if(AbstractSegment.isSegment(segment)) {
			this[ID_SEGMENT].push(segment);
		} else {
			throw new Error("Unknown segment type");
		}
	}

	match(path: string, options: MatchOptions = {}): false | R {
		const {decode} = options;
		const segments = this[ID_SEGMENT];
		if(decode) {
			path = typeof decode === "function" ? decode(path) : decodeURIComponent(path);
		}
		path = normalize(path);
		if(segments.length === 0) {
			return path === this.path ? {} as R : false;
		}
		const found = path === "/" ? [] : path.substring(1).split("/");
		const result: any = {};
		let index = 0;
		for(let segment of segments) {
			const compare = segment.compare(found[index], index, found);
			if(!compare) {
				return false;
			}
			index += compare.offset;
			if(compare.data) {
				Object.assign(result, compare.data);
			}
		}
		if(found.length !== index) {
			return false;
		}
		return result;
	}

	matchToPath(options: MatchToPathOptions<R> = {}): string {
		const {data = {}, encode = true} = options;
		const segments = this[ID_SEGMENT];
		if(segments.length === 0) {
			return this.path;
		}
		const enc = encode ? (typeof encode === "function" ? encode : encodeURIComponent) : undefined;
		const all: string[] = [];
		for(let segment of segments) {
			const value = segment.replace(data, enc);
			if(value) {
				all.push(value);
			}
		}
		return "/" + all.join("/");
	}

	static itMe(value: any): value is Pattern {
		return value && value[ID_KEY] === true;
	}
}
