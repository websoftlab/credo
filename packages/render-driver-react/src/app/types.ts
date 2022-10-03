import type { App, Page, API } from "@phragon/app";
import type { Action, Location, To } from "history";
import type { ElementType, ReactNode, FC } from "react";
import type React from "react";
import type ReactDOM from "react-dom";
import type { Root } from "react-dom/client";
import type { Navigator } from "./route";

export interface OnAppMountHook {
	app: App.StoreInterface;
}

type AppProps = {
	api: API.ApiInterface<ElementType>;
	navigator: Navigator;
};

interface Prevented {
	readonly defaultPrevented: boolean;
	preventDefault(): void;
}

export interface OnAppRenderHook extends Prevented {
	React: typeof React;
	ReactDOM: typeof ReactDOM;
	hydrate: boolean;
	ref: HTMLElement;
	App: FC<AppProps>;
	props: AppProps;
	root?: Root;
}

export interface OnLocationChangeHook {
	navigator: Navigator;
	location: Location;
	action: Action;
}

export interface OnPageMountHook {
	page: Page.StoreInterface<ElementType>;
	navigator: Navigator;
	location: Location;
	action: Action;
	error: boolean;
}

export interface OnBeforeNavigateHook extends Prevented {
	to: To;
	replace: boolean;
	state: any;
	scroll: boolean;
}

export interface OnBeforeHistoryNavigateHook extends Prevented {
	delta: number;
	action: "go" | "back" | "forward";
}

export interface OnPageErrorHook {
	code: number;
	message: string;
}

export interface OnPageTitleHook {
	title: string;
	mutate: boolean;
}

export interface OnPageHistoryScrollHook extends Prevented {
	scroll: {
		x: number;
		y: number;
	};
}

export interface OnPageClickHook extends Prevented {
	to: To;
	replace: boolean;
	state: any;
	scroll: boolean;
}

export interface OnPageAnchorClickHook extends OnPageClickHook {
	element: Element | HTMLAnchorElement;
	nativeEvent: MouseEvent;
}

export type ComponentLayout = FC<LayoutProps>;

export type ComponentPage<Data = {}, P = {}> = FC<PageProps<Data, P>>;

export type ComponentPageError = FC<PageErrorProps>;

export type ComponentPageSpin = FC<PageSpinProps>;

export interface LayoutProps {
	page: Page.StoreInterface<ElementType>;
	children?: ReactNode | ReactNode[] | undefined;
}

export type PageProps<Data = {}, P = {}> = P & {
	pageData: Page.DataType & Data;
};

export interface PageErrorProps {
	code: number;
	message: string;
}

export interface PageSpinProps {
	spin: boolean;
}
