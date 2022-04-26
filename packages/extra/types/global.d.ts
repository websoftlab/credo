import type { Config } from "@phragon/server";
import type { PhragonExtraFavicon } from "@phragon/extra/types";

declare module "@phragon/server" {
	namespace Config {
		export interface Config {
			favicon?: PhragonExtraFavicon;
		}
	}
}
