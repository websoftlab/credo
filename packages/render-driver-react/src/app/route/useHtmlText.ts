import type {RefObject} from "react";
import type {History} from "history";
import {useHistory} from "react-router-dom";
import {useIsomorphicLayoutEffect} from "./utils";

const LINK_CACHE = Symbol("link.cache");

type LinkCache = {
	handler(e: MouseEvent): void;
	url: string;
	history: History;
};

function makeUrl(element: HTMLAnchorElement | Location, withHash = true) {
	return element.pathname + element.search + (withHash ? element.hash : "");
}

function initLink(history: History, element: HTMLAnchorElement) {
	let cache: LinkCache | undefined = (element as any)[LINK_CACHE];
	if(cache) {
		if(cache.history === history && cache.url === makeUrl(element)) {
			return;
		}
		element.removeEventListener("click", cache.handler, false);
		delete (element as any)[LINK_CACHE];
	}
	if(element.origin !== location.origin || element.target !== "" && element.target !== "_self") {
		return;
	}
	const url = makeUrl(element);
	const handler = (e: MouseEvent) => {
		if(e.defaultPrevented) {
			return;
		}
		e.preventDefault();
		if(makeUrl(element, false) === makeUrl(location, false)) {
			history.replace(url);
		} else {
			history.push(url);
		}
	};
	element.addEventListener("click", handler, false);
	(element as any)[LINK_CACHE] = {
		history,
		url,
		handler,
	} as LinkCache;
}

function initHtml(history: History, element: HTMLElement) {
	if(element.nodeType !== 1) {
		return;
	}
	if(element.nodeName === "A") {
		initLink(history, element as HTMLAnchorElement);
	} else if(element.firstChild) {
		const list = element.querySelectorAll("a[href]");
		for(let i = 0; i < list.length; i++) {
			initLink(history, list[i] as HTMLAnchorElement);
		}
	}
}

export default function useHtmlText<T extends HTMLElement = HTMLElement>(ref: RefObject<T>) {
	const history = useHistory();
	useIsomorphicLayoutEffect(() => {
		if(history && ref.current) {
			initHtml(history, ref.current);
		}
	}, [history, ref.current || null]);
}
