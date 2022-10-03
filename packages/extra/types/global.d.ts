import type { Config } from "@phragon/server";
import type { PhragonExtraFavicon, PhragonExtraPageData } from "@phragon/extra/types";

declare module "@phragon/server" {
	namespace Config {
		export interface Config {
			favicon?: PhragonExtraFavicon;
			pageData?: PhragonExtraPageData;
		}
	}
}
