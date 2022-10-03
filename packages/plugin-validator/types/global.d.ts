import type { ValidateService } from "@phragon/plugin-validator";

declare module "@phragon/server" {
	interface PhragonJS {
		services: PhragonServices;
	}
	interface PhragonServices {
		validator: ValidateService;
	}
}
