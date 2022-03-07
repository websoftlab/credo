import type {Config} from "@credo-js/server";
import type {CredoExtraFavicon} from "../src/types";

declare module "@credo-js/server" {
	namespace Config {
		export interface Config {
			favicon?: CredoExtraFavicon;
		}
	}
}