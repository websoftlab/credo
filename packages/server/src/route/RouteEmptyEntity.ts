import type { Route } from "../types";
import RouteEntity from "./RouteEntity";

export default abstract class RouteEmptyEntity extends RouteEntity implements Route.RouteEmpty {
	name: string;
	context: Route.Context;
	methods: string[];

	protected constructor(type: number, point: Route.RouteEmpty) {
		super(type);

		this.name = point.context.name;
		this.context = point.context;
		this.methods = point.methods;
	}

	method(method: string): boolean {
		return this.methods.includes(method);
	}
}
