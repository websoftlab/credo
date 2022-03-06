import {compilePath} from "./compilePath";
import type {PathToPatternOptions, PatternInterface} from "./types";

const pathCache: Record<string, PatternInterface> = {};

export default function pathToPattern<R = any>(path: string, options: PathToPatternOptions = {}): PatternInterface<R> {
	const {
		cacheable = true
	} = options;

	if(cacheable && pathCache.hasOwnProperty(path)) {
		return pathCache[path];
	}

	const pattern = compilePath(path);
	if(cacheable) {
		pathCache[path] = pattern;

		// after normalize path
		if(path !== pattern.path) {
			pathCache[pattern.path] = pattern;
		}
	}

	return pattern;
}

