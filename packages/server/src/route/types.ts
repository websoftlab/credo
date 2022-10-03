import type RoutePattern from "./RoutePattern";
import type RouteGroup from "./RouteGroup";
import type RouteDynamic from "./RouteDynamic";
import type { RouteConfig } from "../types";

export type RouteVariant = RoutePattern | RouteGroup | RouteDynamic;

export interface NormalizeRoute {
	group?: boolean;
	cache?: RouteConfig.Cache;
	details?: any;
	middleware?: RouteConfig.ExtraMiddlewareType[];
	routes?: RouteConfig.Route[];
	method?: RouteConfig.Method;
	name: string;
	responder?: string | [string, any];
	path?: RouteConfig.Path;
	controller?: RouteConfig.Controller;
	_originName: string;
}

export interface NRCPDecodeType {
	method?: RouteConfig.Method;
	name: string;
	responder?: string;
	controller?: string;
	path?: string;
}

export interface NRCPDecode<CProps = any, RProps = any, Details = any> {
	method?: RouteConfig.Method;
	name: string;
	responder?: string | [string, RProps];
	controller?: string | [string, CProps];
	path?: string;
	details?: Details;
}
