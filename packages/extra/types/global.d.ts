import type { PhragonExtraFavicon, PhragonExtraPageData } from "@phragon/extra/types";

declare module "@phragon/server" {
	namespace Config {
		interface Config {
			favicon?: PhragonExtraFavicon;
			pageData?: PhragonExtraPageData;
		}
	}
}
