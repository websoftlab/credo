import type { Route } from "../types";
import type { PatternInterface } from "@phragon/path-to-pattern";
import RouteEmptyEntity from "./RouteEmptyEntity";
import { constants } from "./constants";

export default class RoutePattern extends RouteEmptyEntity implements Route.RoutePattern {
	match: Route.Match;
	pattern?: PatternInterface;

	constructor({ match, pattern, ...rest }: Route.RoutePattern) {
		super(constants.pattern, rest);
		this.match = match;
		this.pattern = pattern;
	}
}
