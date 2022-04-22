import { subscribeFaviconHook, FaviconHook } from "./favicon";
import type { CredoJS } from "@credo-js/server";
export type { CredoExtraFavicon, FaviconSize } from "./types";

export function bootstrap(credo: CredoJS) {
	subscribeFaviconHook(credo);
}

export { subscribeFaviconHook, FaviconHook };
