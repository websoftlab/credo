import { subscribeFaviconHook, FaviconHook } from "./favicon";
import type { PhragonJS } from "@phragon/server";
export type { PhragonExtraFavicon, FaviconSize } from "./types";

export function bootstrap(phragon: PhragonJS) {
	subscribeFaviconHook(phragon);
}

export { subscribeFaviconHook, FaviconHook };
