import type { API } from "@phragon/app";
import type { ElementType } from "react";
import { createContext, useContext } from "react";
import { invariant } from "@phragon/utils";

export const ApiContext = createContext<API.ApiInterface<ElementType> | null>(null);

export function useApiContext(): API.ApiInterface<ElementType> {
	const ctx = useContext(ApiContext);
	invariant(ctx, "API Context is not defined in react tree");
	return ctx;
}

export function usePageStore() {
	return useApiContext().page;
}

export function useAppStore() {
	return useApiContext().app;
}

export function useService<T extends keyof API.Services>(name: T): API.Services[T] {
	const services = useApiContext().services;
	const service = services[name];
	invariant(service && services.hasOwnProperty(name), `API service ${name} is not defined`);
	return service;
}
