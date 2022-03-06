import pathToPattern from "./pathToPattern";
import type {PatternInterface, ReplaceOptions} from "./types";
import Pattern from "./Pattern";

export default function replacePath<R = any>(path: string | PatternInterface, options: ReplaceOptions<R> = {}) {
	if(typeof path === "string") {
		path = pathToPattern(path);
	} else if(!Pattern.itMe(path)) {
		throw new Error("Invalid path argument for matchPath");
	}
	return path.replace(options);
}
