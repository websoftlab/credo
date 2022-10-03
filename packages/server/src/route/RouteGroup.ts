import { Route } from "../types";
import { Context } from "koa";
import RouteEntity from "./RouteEntity";
import { constants } from "./constants";
import { createMethods, trimSegment } from "./utils";
import type { RouteVariant } from "./types";

export default class RouteGroup extends RouteEntity implements Route.RouteGroup {
	methods?: string[];
	path: string;
	segments: string[];
	routes: RouteVariant[] = [];

	get length(): number {
		return this.segments.length;
	}

	get routeLength(): number {
		return this.routes.length;
	}

	get nestedRouteLength(): number {
		return this.routes.reduce(
			(calc, route) => calc + (RouteEntity.isRouteGroup(route) ? route.nestedRouteLength : 1),
			0
		);
	}

	constructor(path: string, methods?: string | string[]) {
		super(constants.group);

		path = trimSegment(path);
		if (!path.length || path.includes("//")) {
			throw new Error(`Invalid group path [${path}]`);
		}
		this.path = `/${path}/`;
		this.segments = path.split("/");
		if (methods) {
			this.methods = createMethods(methods);
		}
	}

	method(method: string): boolean {
		return this.methods ? this.methods.includes(method) : true;
	}

	match(ctx: Context, withMethod: boolean = true): boolean {
		if (withMethod && !this.method(ctx.method)) {
			return false;
		}
		let path = ctx.path;
		if (path.startsWith(this.path)) {
			return true;
		}
		if (!path.endsWith("/")) {
			path += "/";
		}
		return path === this.path;
	}
}
