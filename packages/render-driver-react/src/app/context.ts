import type { API } from "@phragon/app";
import type { ElementType } from "react";
import { createContext, useContext } from "react";

export const ApiContext = createContext<API.ApiInterface<ElementType> | null>(null);

export const useApiContext = (): API.ApiInterface<ElementType> => {
	const ctx = useContext(ApiContext);
	if (!ctx) {
		throw new Error("API Context is not defined in react tree");
	}
	return ctx;
};

export const usePageStore = () => {
	const api = useApiContext();
	return api.page;
};

export const useAppStore = () => {
	const api = useApiContext();
	return api.app;
};

export const useServices = (): API.Services => {
	const api = useApiContext();
	return api.services;
};

export const useTranslator = () => {
	const api = useApiContext();
	return api.services.translator;
};
