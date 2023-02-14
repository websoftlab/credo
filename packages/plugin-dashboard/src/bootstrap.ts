import type { PhragonJS } from "@phragon/server";
import { createDashboardPanel, createOnAppStateHook, createOnResponseHook, createOnLoadHook } from "./dashboardPanel";

export default function bootstrap(phragon: PhragonJS) {
	if (!phragon.isApp() || phragon.dashboard) {
		return;
	}

	phragon.define("dashboard", createDashboardPanel(phragon));

	phragon.hooks.subscribe("onAppState", createOnAppStateHook(phragon));
	phragon.hooks.subscribe("onResponse", createOnResponseHook());
	phragon.hooks.once("onLoad", createOnLoadHook(phragon));
}
