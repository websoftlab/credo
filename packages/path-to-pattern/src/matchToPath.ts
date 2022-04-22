import type { PatternInterface, MatchToPathOptions } from "./types";
import pathToPattern from "./pathToPattern";
import Pattern from "./Pattern";

export default function matchToPath<R = any>(path: string | PatternInterface, options: MatchToPathOptions<R> = {}) {
	if (typeof path === "string") {
		path = pathToPattern(path);
	} else if (!Pattern.itMe(path)) {
		throw new Error("Invalid path argument for matchPath");
	}
	return path.matchToPath(options);
}
