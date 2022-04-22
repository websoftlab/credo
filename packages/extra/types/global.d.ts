import type { Config } from "@credo-js/server";
import type { CredoExtraFavicon } from "@credo-js/extra/types";

declare module "@credo-js/server" {
	namespace Config {
		export interface Config {
			favicon?: CredoExtraFavicon;
		}
	}
}
