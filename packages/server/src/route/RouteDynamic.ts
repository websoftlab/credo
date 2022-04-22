import type { Route } from "../types";
import { constants } from "./constants";
import RouteEmptyEntity from "./RouteEmptyEntity";

export default class RouteDynamic extends RouteEmptyEntity implements Route.RouteDynamic {
	match: Route.Match;
	matchToPath?: Route.MatchToPath;
	length?: number;

	constructor({ match, matchToPath, length, ...rest }: Route.RouteDynamic) {
		super(constants.dynamic, rest);
		this.match = match;
		if (typeof matchToPath === "function") {
			this.matchToPath = matchToPath;
		}
		if (typeof length === "number") {
			this.length = length;
		} else if (typeof length === "function") {
			Object.defineProperty(this, "length", {
				get: length,
			});
		}
	}
}
