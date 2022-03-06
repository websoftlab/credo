import pathToPattern from "./pathToPattern";
import type {MatchOptions, PatternInterface} from "./types";
import Pattern from "./Pattern";

export default function matchPath(path: string | PatternInterface, pathname: string, options: MatchOptions = {}) {
	if(typeof path === "string") {
		path = pathToPattern(path);
	} else if(!Pattern.itMe(path)) {
		throw new Error("Invalid path argument for matchPath");
	}
	return path.match(pathname, options);
}