import React from "react";
import ReactDOM from "react-dom";
import { createBrowserHistory } from "history";
import { Api, Page, createHttpJsonService, PageStore } from "@credo-js/app";
import App from "./App";
import loadDocument from "./loadDocument";
import { load, loaded, component } from "../loadable";
import { AppStore } from "@credo-js/app";
import onHistoryScroll from "./onHistoryScroll";
import createEvent from "./createEvent";
import type { ReactElement, ElementType } from "react";
import type { OnAppRenderHook } from "../app";

type React15Root = { render: Function };

function isReact18(obj: any): obj is {
	createRoot: (node: HTMLElement) => React15Root;
	hydrateRoot: (node: HTMLElement, element: ReactElement) => React15Root;
} {
	return (
		"createRoot" in obj &&
		"hydrateRoot" in obj &&
		typeof obj.createRoot === "function" &&
		typeof obj.hydrateRoot === "function"
	);
}

const renderPage: Page.ClientRenderHandler<ElementType, { historyScroll?: boolean }> = async function renderPage(
	node: HTMLElement,
	options = {}
) {
	const data: Page.DocumentAppOptions = loadDocument("app-page");
	const { historyScroll = true, bootloader = [] } = options;
	const {
		ssr = false,
		getQueryId,
		baseUrl,
		title,
		language,
		loadable = [],
		state = {},
		found,
		response,
		message,
		code,
	} = data;

	const { protocol, host } = window.location;
	const http = createHttpJsonService({
		protocol: String(protocol).substring(0, 5) === "https" ? "https" : "http",
		host,
	});

	const app = new AppStore(state);
	const page = new PageStore({
		getQueryId,
		http,
		loader: { load, loaded, component },
	});
	const api = new Api<ElementType>("client", app, page);
	const history = createBrowserHistory();

	api.services.history = history;

	// client system bootstrap
	bootloader.forEach((func) => {
		try {
			func(api);
		} catch (err) {
			if (__DEV__) {
				console.error("Bootstrap callback failure", err);
			}
		}
	});

	if (language) {
		await app.loadLanguage(language);
	}

	// load base page props from head tags
	api.baseUrl = typeof baseUrl === "string" ? baseUrl : "/";
	api.title = title || document.title;
	api.ssr = ssr;

	if (historyScroll) {
		onHistoryScroll(api);
	}

	const render = (hydrate: boolean = false) => {
		let root: null | React15Root = null;
		const evn: OnAppRenderHook = createEvent({
			React,
			ReactDOM,
			hydrate,
			ref: node,
			App,
			props: {
				api,
				history,
			},
		});

		api.emit<OnAppRenderHook>("onRender", evn);

		if (!evn.defaultPrevented) {
			const reactDom = React.createElement(evn.App, evn.props);
			if (evn.hydrate) {
				if (isReact18(ReactDOM)) {
					root = ReactDOM.hydrateRoot(evn.ref, reactDom);
				} else {
					ReactDOM.hydrate(reactDom, evn.ref);
				}
			} else {
				if (isReact18(ReactDOM)) {
					root = ReactDOM.createRoot(evn.ref);
					root.render(reactDom);
				} else {
					ReactDOM.render(reactDom, evn.ref);
				}
			}
		}

		if (root != null) {
			// @ts-ignore
			api.root = root;
		}
	};

	const { location } = history;
	const url = location.pathname + location.search;
	const key = location.key || "";

	const error = (err: Error | string, code: number = 500) => {
		if (typeof err === "string") {
			err = new Error(err);
			// @ts-ignore
			err.code = code;
		}
		page.setError(err, url, key);
		render();
	};

	// @ts-ignore
	window.api = api;

	const err1 = () => app.translate("system.errors.pageResponseIsEmpty", "Page response is empty");
	const err2 = () => app.translate("system.errors.unknown", "Unknown error");

	if (api.ssr && found) {
		try {
			await load(loadable);
		} catch (err) {
			return error(err as Error);
		}
		if (response) {
			page.setResponse(response, url, key);
			render(true);
		} else {
			error(err1());
		}
	} else if (found) {
		if (response) {
			page.loadDocument(response, url, key);
			render();
		} else {
			error(err1());
		}
	} else {
		error(message || err2(), code);
	}
};

export default renderPage;
