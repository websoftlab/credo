import type { API } from "@phragon/app";
import type { ElementType } from "react";
import { createContext, useContext } from "react";
import { invariant } from "@phragon/utils";

export const ApiContext = createContext<API.ApiInterface<ElementType> | null>(null);

export const useApiContext = (): API.ApiInterface<ElementType> => {
	const ctx = useContext(ApiContext);
	invariant(ctx, "API Context is not defined in react tree");
	return ctx;
};

export const usePageStore = () => {
	return useApiContext().page;
};

export const useAppStore = () => {
	return useApiContext().app;
};

export const useServices = (): API.Services => {
	return useApiContext().services;
};

export const useTranslator = () => {
	return useApiContext().services.translator;
};
