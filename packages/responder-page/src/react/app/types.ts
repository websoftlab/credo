import type {Page} from "../../types";
import type {Action, History, Location} from "history";
import type {ElementType} from "react";
import type {Lexicon} from "@credo-js/lexicon";

export interface OnAppMountHook {
	app: Lexicon.StoreInterface;
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
