import React from "react";
import ReactDOM from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Api, Page, createHttpJsonService, PageStore } from "@phragon/app";
import { toAsync } from "@phragon-util/async";
import App from "./App";
import loadDocument from "./loadDocument";
import { load, loaded, component } from "../loadable";
import { AppStore } from "@phragon/app";
import onHistoryScroll from "./onHistoryScroll";
import { createEvent } from "../app/utils";
import { __isDev__ } from "@phragon-util/global-var";
import { createNavigator, getHistory } from "./navigator";
import type { ElementType } from "react";
import type { OnAppRenderHook } from "../app";

const renderPage: Page.ClientRenderHandler<
	ElementType,
	{ historyScroll?: boolean; appProps?: { strictMode?: boolean } }
> = async function renderPage(node: HTMLElement, options = {}) {
	const data: Page.DocumentAppOptions = loadDocument("app-page");
	const { historyScroll = true, appProps = {}, bootloader = [] } = options;
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

	if (typeof state.buildVersion !== "string") {
		state.buildVersion = "1.0.0";
	}
	if (typeof state.buildId !== "string") {
		state.buildId = null;
	}

	const app = new AppStore(state);
	const page = new PageStore({
		getQueryId,
		buildId: app.build,
		buildVersion: app.version,
		http,
		loader: { load, loaded, component },
	});
	const api = new Api<ElementType>("client", app, page);
	const navigator = createNavigator(api);
	const history = getHistory(navigator);

	// change language
	page.loader((response) => {
		const { data } = response;
		if (data?.$language) {
			const doc = document.documentElement;
			if (doc.hasAttribute("lang")) {
				doc.setAttribute("lang", data.$language);
			}
		}
	});

	api.services.navigator = navigator;

	// client system bootstrap
	await Promise.all(
		bootloader.map(async (func) => {
			try {
				await toAsync(func(api));
			} catch (err) {
				if (__isDev__()) {
					console.error("Bootstrap callback failure", err);
				}
			}
		})
	);

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
		const evn: OnAppRenderHook = createEvent({
			React,
			ReactDOM,
			hydrate,
			ref: node,
			App,
			props: {
				...appProps,
				api,
				navigator,
			},
		});

		api.emit<OnAppRenderHook>("onRender", evn);

		if (!evn.defaultPrevented) {
			const reactDom = React.createElement(evn.App, evn.props);
			if (evn.hydrate) {
				api.root = hydrateRoot(evn.ref, reactDom);
			} else {
				api.root = createRoot(evn.ref);
				api.root.render(reactDom);
			}
		} else if (evn.root) {
			api.root = evn.root;
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

	window.api = api;

	const err1 = () => app.translate("system.errors.pageResponseIsEmpty", "Page response is empty");
	const err2 = () => app.translate("system.errors.unknown", "Unknown error");

	if (found) {
		if (loadable.length > 0) {
			try {
				await load(loadable);
			} catch (err) {
				return error(err as Error);
			}
		}
		if (response) {
			page.loadDocument(response, url, key);
			render(api.ssr);
		} else {
			error(err1());
		}
	} else {
		error(message || err2(), code);
	}
};

export default renderPage;
