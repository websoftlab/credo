import type { App, Page } from "@credo-js/app";
import type { Action, History, Location } from "history";
import type { ElementType } from "react";

export interface OnAppMountHook {
	app: App.StoreInterface;
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
