import type { Route } from "../types";
import RouteEmptyEntity from "./RouteEmptyEntity";
import { constants } from "./constants";

export default class RouteEmpty extends RouteEmptyEntity {
	constructor(point: Route.RouteEmpty) {
		super(constants.empty, point);
	}
}
