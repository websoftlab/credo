import axios from "axios";
import {computed, action, makeObservable, observable} from "mobx";
import {isPlainObject} from "@credo-js/utils";
import type {CancelTokenSource, AxiosInstance, AxiosRequestConfig} from "axios";
import type {Page} from "./types";

async function preload<ComponentType>(loader: Page.Loader<ComponentType>, response: Page.Response) {
	const page = response.page;
	if(page) {
		return loader.loaded(page) ? null : loader.load(page);
	}
	throw new Error(`The page component is not defined in the Page.Response`);
}

function done<ComponentType>(this: PageStore<ComponentType>, url?: string, key?: string) {
	if(url) {
		this.url = url;
		this.key = key || "";
	}
	this.loading = false;
	this.id = Symbol();
}

function isCode(error: any): error is {code: number} {
	return error && typeof error.code === "number";
}

function isObj<T = any>(obj: any): obj is T {
	return typeof obj === "object" && obj != null;
}

function createCodeError(error: any, altCode?: number) {
	let message: string | undefined;
	let code: number | undefined = altCode;
	if(typeof error === "string") {
		message = error;
	} else {
		if(error.message) {
			message = error.message;
		}
		if(isCode(error)) {
			code = error.code;
		}
	}
	const err = new Error(message || "Unknown query error");
	if(typeof code === "number") {
		(err as any).code = code;
	}
	return err;
}

type ResponseFound = { code: number, response: Page.Response };
type ResponseNotFound = { code: number, message: string };
type ResponseRedirect = { redirect: { location: string } };

function isOk(data: any): data is ResponseFound {
	return String(data.code).substring(0, 2) === "20" && "response" in data;
}

function isRedirect(data: any): data is ResponseRedirect {
	return "redirect" in data && typeof data.redirect === "object" && typeof data.redirect.location === "string";
}

type PrivateOptions<ComponentType> = {
	getQueryId: string,
	queryId?: symbol,
	cancelToken?: CancelTokenSource,
	http: AxiosInstance,
	loader: Page.Loader<ComponentType>,
	preload(url: string, key?: string): () => boolean,
}

const PRIVATE_ID = Symbol();

function opt<ComponentType>(store: PageStore<ComponentType>) {
	return store[PRIVATE_ID];
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
			loadDocument: action,
			load: action,
			setError: action,
			setResponse: action,
			title: computed,
		});

		const {http, loader, getQueryId} = options;
		Object.defineProperty(this, "http", {
			configurable: false,
			get() {
				return http;
			}
		});

		this[PRIVATE_ID] = {
			getQueryId: getQueryId || "query",
			http,
			loader,
			preload: (url: string, key?: string) => {

				const prv = opt(this);

				// abort prev request
				if(this.loading) {
					try {
						prv.cancelToken?.cancel();
					} catch(e) {}
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
					if(id === prv.queryId) {
						prv.queryId = undefined;
						prv.cancelToken = undefined;
						return true;
					} else {
						return false;
					}
				}
			}
		};
	}

	get title(): string {
		if(this.error) {
			return this.errorMessage as string;
		} else {
			const title = this.response?.data.title;
			return typeof title === "string" ? title : "Document";
		}
	}

	loadDocument(page: Page.Response, url?: string, key?: string) {
		if(!url) {
			url = typeof location === "undefined" ? "/" : (location.pathname + location.search);
		}

		const prv = opt(this);
		const query = prv.preload(url, key);

		preload(prv.loader, page)
			.then(() => {
				if(query()) {
					this.setResponse(page);
				}
			})
			.catch((err: Error) => {
				if(query()) {
					this.setError(new Error(err.message || "Document load error."));
				}
			});
	}

	load(url: string, key: string, postData: any = null) {
		if(!url) {
			url = "";
		}
		if(this.url === url && this.key === key) {
			return;
		}

		const prv = opt(this);
		const query = prv.preload(url, key);
		const cancelTokenSource = axios.CancelToken.source();

		// private
		prv.cancelToken = cancelTokenSource;

		const complete = (result: ResponseFound | ResponseNotFound | null) => {
			if(!query() || result === null) {
				return;
			}
			if (isOk(result)) {
				this.setResponse(result.response);
			} else {
				this.setError(createCodeError(result));
			}
		};

		const queryId = `${prv.getQueryId}-${Date.now()}`;
		const requestConfig: AxiosRequestConfig = {
			url,
			method: "get",
			cancelToken: cancelTokenSource.token,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
		};

		if(postData != null) {
			if(!isPlainObject(postData)) {
				throw new Error("Post data must be plain object");
			}
			requestConfig.method = "post";
			requestConfig.data = JSON.stringify({
				... postData,
				[queryId]: ""
			});
		} else {
			requestConfig.url += `${url.includes('?') ? '&' : '?'}${queryId}`;
		}

		prv
			.http(requestConfig)
			.then((response) => {
				const {data, status} = response;
				if(isObj(data)) {
					if(typeof data.code === "undefined") {
						data.code = status;
					}
					return data;
				} else {
					throw createCodeError("Invalid server response, json type expected", status);
				}
			})
			.then((result) => {
				if(isOk(result)) {
					return preload(prv.loader, result.response).then(() => result);
				}
				if(isRedirect(result)) {
					window.location.assign(result.redirect.location);
					return null;
				}
				return result;
			})
			.then(complete)
			.catch((err) => {
				complete({code: isCode(err) ? err.code : 500, message: err.message});
			});
	}

	setError(err: Error, url?: string, key?: string) {
		this.error = true;
		this.errorMessage = err.message || "Unknown query error";
		this.code = isCode(err) ? err.code : 500;
		this.response = null;
		done.call(this, url, key);
	}

	setResponse(response: Page.Response, url?: string, key?: string) {
		const {page, props = {}, data = {}} = response;
		this.error = false;
		this.errorMessage = null;
		this.code = isCode(response) ? response.code : 200;
		this.response = {
			Component: opt(this).loader.component(page),
			props,
			data,
		};
		done.call(this, url, key);
	}
}
