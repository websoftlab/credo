import type { App, Page, API } from "@phragon/app";
import type { Action, History, Location } from "history";
import type { ElementType, FC } from "react";
import type React from "react";
import type ReactDOM from "react-dom";

export interface OnAppMountHook {
	app: App.StoreInterface;
}

type AppProps = {
	api: API.ApiInterface<ElementType>;
	history: History;
};

export interface OnAppRenderHook {
	React: typeof React;
	ReactDOM: typeof ReactDOM;
	hydrate: boolean;
	ref: HTMLElement;
	App: FC<AppProps>;
	props: AppProps;
	readonly defaultPrevented: boolean;
	preventDefault(): void;
}

export interface OnLocationChangeHook {
	location: Location;
	action: Action;
}

export interface OnPageHook {
	page: Page.StoreInterface<ElementType>;
	history: History;
}

export interface OnPageTitleHook {
	title: string;
	mutate: boolean;
}

export interface OnPageHistoryScrollHook {
	scroll: {
		x: number;
		y: number;
	};
	readonly defaultPrevented: boolean;
	preventDefault(): void;
}
