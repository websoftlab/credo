import type { Pattern } from "@phragon/path-to-pattern";

const PATTERN_LIST = Symbol();

export default class UrlPattern {
	[PATTERN_LIST]: Record<string, Pattern | undefined> = {};

	set(name: string, pattern: Pattern) {
		this[PATTERN_LIST][name] = pattern;
	}

	get(name: string) {
		return this[PATTERN_LIST][name] || null;
	}

	del(name: string) {
		delete this[PATTERN_LIST][name];
	}

	has(name: string) {
		return this[PATTERN_LIST].hasOwnProperty(name);
	}
}
