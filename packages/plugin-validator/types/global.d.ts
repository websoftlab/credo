import type { ValidateService } from "@phragon/plugin-validator";

declare module "@phragon/server" {
	interface PhragonJS {
		services: PhragonServices;
	}
	interface PhragonJSGlobal {
		services: PhragonServices;
	}
	interface PhragonJSCmd {
		services: PhragonServices;
	}
	interface PhragonJSCron {
		services: PhragonServices;
	}
	interface PhragonServices {
		validator: ValidateService;
	}
}
