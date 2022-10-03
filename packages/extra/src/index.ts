import { subscribeFaviconHook, FaviconHook } from "./favicon";
import { subscribePageDataHook, PageDataHook } from "./page";
import type { PhragonJS } from "@phragon/server";
export type {
	PhragonExtraFavicon,
	FaviconSize,
	PhragonExtraPageData,
	HTMLLinkElement,
	HTMLMetaElement,
	HTMLStyleElement,
	HTMTLEvalScriptElement,
	HTMLScriptElement,
} from "./types";

export function bootstrap(phragon: PhragonJS) {
	subscribeFaviconHook(phragon);
	subscribePageDataHook(phragon);
}

export { subscribeFaviconHook, FaviconHook, subscribePageDataHook, PageDataHook };
