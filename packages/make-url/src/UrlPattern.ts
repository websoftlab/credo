import type { Pattern } from "@phragon/path-to-pattern";

const PATTERN_LIST = Symbol();

export class UrlPattern {
	[PATTERN_LIST]: Map<string, Pattern> = new Map();

	get size() {
		return this[PATTERN_LIST].size;
	}

	set(name: string, pattern: Pattern) {
		this[PATTERN_LIST].set(name, pattern);
	}

	get(name: string) {
		return this[PATTERN_LIST].get(name) || null;
	}

	del(name: string) {
		this[PATTERN_LIST].delete(name);
	}

	has(name: string) {
		return this[PATTERN_LIST].has(name);
	}

	clear() {
		this[PATTERN_LIST].clear();
	}

	forEach(callback: (value: Pattern, key: string, pattern: UrlPattern) => void) {
		this[PATTERN_LIST].forEach((value, key) => callback(value, key, this));
	}
}

export const pattern = new UrlPattern();
