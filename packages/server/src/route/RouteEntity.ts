import type RouteGroup from "./RouteGroup";
import type RoutePattern from "./RoutePattern";
import type RouteDynamic from "./RouteDynamic";
import type RouteEmpty from "./RouteEmpty";
import {constants} from "./constants";

const ROUTE_KEY = Symbol();

export default abstract class RouteEntity {
	[ROUTE_KEY]: number;

	public index: number = 0;
	public priority: number = 1;

	protected constructor(type: number) {
		this[ROUTE_KEY] = type;
	}

	static isRoute(obj: any): obj is (RouteGroup | RoutePattern | RouteDynamic) {
		if(!obj) {
			return false;
		}
		const id = obj[ROUTE_KEY];
		return (
			id === constants.group ||
			id === constants.pattern ||
			id === constants.dynamic
		);
	}

	static isRouteGroup(obj: any): obj is RouteGroup { return obj && obj[ROUTE_KEY] === constants.group; }
	static isRoutePattern(obj: any): obj is RoutePattern { return obj && obj[ROUTE_KEY] === constants.pattern; }
	static isRouteDynamic(obj: any): obj is RouteDynamic { return obj && obj[ROUTE_KEY] === constants.dynamic; }
	static isRouteEmpty(obj: any): obj is RouteEmpty { return obj && obj[ROUTE_KEY] === constants.empty; }
}