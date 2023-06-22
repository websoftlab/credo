import axios, { AxiosHeaders } from "axios";
import { computed, action, makeObservable, observable } from "mobx";
import { isPlainObject } from "@phragon-util/plain-object";
import { toAsync } from "@phragon-util/async";
import type { CancelTokenSource, AxiosInstance, AxiosRequestConfig } from "axios";
import type { Page } from "./types";

async function preload<ComponentType>(loader: Page.Loader<ComponentType>, response: Page.Response) {
	const page = response.page;
	if (page) {
		return loader.loaded(page) ? null : loader.load(page);
	}
	throw new Error(`The page component is not defined in the Page.Response`);
}

async function emit(events: Function[], page: Page.Response) {
	for (const event of events) {
		await toAsync(event(page));
	}
}

function done<ComponentType>(this: PageStore<ComponentType>, url?: string, key?: string) {
	if (url) {
		this.url = url;
		this.key = key || "";
	}
	this.loading = false;
	this.id = Symbol();
	this.data = {};
}

function isCode(error: any): error is { code: number } {
	return error && typeof error.code === "number";
}

function isObj<T = any>(obj: any): obj is T {
	return typeof obj === "object" && obj != null;
}

function createCodeError(error: any, altCode?: number) {
	let message: string | undefined;
	let code: number | undefined = altCode;
	if (typeof error === "string") {
		message = error;
	} else {
		if (error.message) {
			message = error.message;
		}
		if (isCode(error)) {
			code = error.code;
		}
	}
	const err = new Error(message || "Unknown query error");
	if (typeof code === "number") {
		(err as any).code = code;
	}
	return err;
}

type ResponseFound = { ok: true; code: number; response: Page.Response };
type ResponseNotFound = { ok: false; code: number; message: string };
type ResponseRedirect = { redirect: { location: string; back?: boolean } };

const reloadId = Symbol("reload.id");

function isReload(data: unknown) {
	return isPlainObject(data) && data[reloadId] === true;
}

function isOk(data: any): data is ResponseFound {
	return isPlainObject(data) && data.ok === true && "response" in data;
}

function isRedirect(data: any): data is ResponseRedirect {
	return "redirect" in data && typeof data.redirect === "object" && typeof data.redirect.location === "string";
}

type PrivateOptions<ComponentType> = {
	buildId: string | null;
	buildVersion: string;
	events: Function[];
	getQueryId: string;
	queryId?: symbol;
	cancelToken?: CancelTokenSource;
	http: AxiosInstance;
	loader: Page.Loader<ComponentType>;
	preload(url: string, key?: string): () => boolean;
};

const PRIVATE_ID = Symbol();

function opt<ComponentType>(store: PageStore<ComponentType>) {
	return store[PRIVATE_ID];
}

function onTime(fn: Function) {
	if (typeof window !== "undefined") {
		window.setTimeout(fn, 0);
	}
	return null;
}

export default class PageStore<ComponentType> implements Page.StoreInterface<ComponentType> {
	id: symbol = Symbol();
	url: string = "";
	key: string = "";
	code: number = 200;
	response: Page.ComponentResponse<ComponentType> | null = null;
	loading: boolean = false;
	error: boolean = false;
	errorMessage: string | null = null;
	http!: AxiosInstance;
	data: any = {};

	[PRIVATE_ID]: PrivateOptions<ComponentType>;

	constructor(options: Page.StoreCtorOptions<ComponentType>) {
		makeObservable(this, {
			response: observable,
			loading: observable,
			id: observable,
			url: observable,
			key: observable,
			code: observable,
			error: observable,
			errorMessage: observable,
			data: observable,
			loadDocument: action,
			load: action,
			setError: action,
			setResponse: action,
			setData: action,
			title: computed,
		});

		const { http, loader, buildId = null, buildVersion, getQueryId } = options;
		Object.defineProperty(this, "http", {
			configurable: false,
			get() {
				return http;
			},
		});

		this[PRIVATE_ID] = {
			events: [],
			getQueryId: getQueryId || "query",
			buildId,
			buildVersion,
			http,
			loader,
			preload: (url: string, key?: string) => {
				const prv = opt(this);

				// abort prev request
				if (this.loading) {
					try {
						prv.cancelToken?.cancel();
					} catch (e) {}
				}

				const id = Symbol();

				this.loading = true;
				this.url = url;
				this.key = key || "";
				this.error = false;
				this.errorMessage = null;

				// private
				prv.queryId = id;

				return () => {
					if (id === prv.queryId) {
						prv.queryId = undefined;
						prv.cancelToken = undefined;
						return true;
					} else {
						return false;
					}
				};
			},
		};
	}

	get title(): string {
		if (this.error) {
			return this.errorMessage as string;
		} else {
			const title = this.response?.data.title;
			return typeof title === "string" ? title : "Document";
		}
	}

	loader(callback: (page: Page.Response) => void | Promise<void>): () => void {
		const prv = opt(this);
		if (typeof callback === "function" && !prv.events.includes(callback)) {
			prv.events.push(callback);
		}
		return () => {
			const index = prv.events.indexOf(callback);
			if (index !== -1) {
				prv.events.splice(index, 1);
			}
		};
	}

	loadDocument(page: Page.Response, url?: string, key?: string) {
		if (!url) {
			url = typeof location === "undefined" ? "/" : location.pathname + location.search;
		}

		const prv = opt(this);
		const query = prv.preload(url, key);

		preload(prv.loader, page)
			.then(() => emit(prv.events, page))
			.then(() => {
				if (query()) {
					this.setResponse(page);
				}
			})
			.catch((err: Error) => {
				if (query()) {
					this.setError(new Error(err.message || "Document load error."));
				}
			});
	}

	load(url: string, key: string, postData: any = null) {
		if (!url) {
			url = "";
		}
		if (this.url === url && this.key === key) {
			return;
		}

		const prv = opt(this);
		const query = prv.preload(url, key);
		const cancelTokenSource = axios.CancelToken.source();

		// private
		prv.cancelToken = cancelTokenSource;

		const complete = (result: ResponseFound | ResponseNotFound | null) => {
			if (!query() || result === null) {
				return;
			}
			if (isOk(result)) {
				this.setResponse(result.response);
			} else {
				this.setError(createCodeError(result));
			}
		};

		const buildId = prv.buildId;
		const buildVersion = prv.buildVersion;
		function isOld(version: string | null | undefined, id: string | null | undefined) {
			if (version && buildVersion && version !== buildVersion) {
				return true;
			}
			if (id && buildId && id !== buildId) {
				return true;
			}
			return false;
		}

		const queryId = `${prv.getQueryId}-${Date.now()}`;
		const headers: AxiosHeaders = new AxiosHeaders({
			"Content-Type": "application/json",
			Accept: "application/json",
			"X-Build-Version": buildVersion,
		});
		if (buildId) {
			headers.set("X-Build-Id", buildId);
		}

		const requestConfig: AxiosRequestConfig = {
			url,
			method: "get",
			cancelToken: cancelTokenSource.token,
			headers,
		};

		if (postData != null) {
			if (!isPlainObject(postData)) {
				throw new Error("Post data must be plain object");
			}
			requestConfig.method = "post";
			requestConfig.data = JSON.stringify({
				...postData,
				[queryId]: "",
			});
		} else {
			requestConfig.url += `${url.includes("?") ? "&" : "?"}${queryId}`;
		}

		prv.http(requestConfig)
			.then((response) => {
				const { data, status, headers } = response;
				if (isOld(headers["x-build-version"], headers["x-build-id"])) {
					return { [reloadId]: true };
				}
				if (isObj(data)) {
					if (typeof data.code === "undefined") {
						data.code = status;
					}
					return data;
				} else {
					throw createCodeError("Invalid server response, json type expected", status);
				}
			})
			.then((result) => {
				if (isOk(result)) {
					return preload(prv.loader, result.response)
						.then(() => emit(prv.events, result.response))
						.then(() => result);
				}
				if (isReload(result)) {
					return onTime(() => {
						window.location.reload();
					});
				}
				if (isRedirect(result)) {
					const { back = false, location } = result.redirect;
					if (back) {
						history.back();
					}
					return onTime(() => {
						window.location.assign(location);
					});
				}
				return result;
			})
			.then(complete)
			.catch((err) => {
				complete({ ok: false, code: isCode(err) ? err.code : 500, message: err.message });
			});
	}

	setData(value: any): void;
	setData(name: string, value: any): void;
	setData(name: string | any, value?: any) {
		if (isPlainObject(name)) {
			Object.keys(name).forEach((key) => {
				this.data[key] = name[key];
			});
		} else if (typeof name === "string") {
			this.data[name] = value;
		}
	}

	setError(err: Error, url?: string, key?: string) {
		this.error = true;
		this.errorMessage = err.message || "Unknown query error";
		this.code = isCode(err) ? err.code : 500;
		this.response = null;
		done.call(this, url, key);
	}

	setResponse(response: Page.Response, url?: string, key?: string) {
		const { page, props = {}, data = {} } = response;
		this.error = false;
		this.errorMessage = null;
		this.code = isCode(response) ? response.code : 200;
		this.response = {
			name: page,
			Component: opt(this).loader.component(page),
			props,
			data,
		};
		done.call(this, url, key);
	}
}
