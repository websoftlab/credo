import type { BaseContext } from "koa";
import type { DashboardPanel } from "@phragon/plugin-dashboard";

declare module "koa" {
	interface Context extends BaseContext {
		dashboardPlugin?: {
			name: string;
			mode: "web" | "api" | "raw";
			details: any;
		};
	}
}

declare module "@phragon/server" {
	namespace Config {
		interface PluginDashboard {
			icon?: string;
			title?: string;
			path?: string;
		}
	}
	interface PhragonJS {
		dashboard: DashboardPanel;
	}
	interface ConfigHandler {
		(name: "dashboard", def?: Partial<Config.PluginDashboard>): Config.PluginDashboard;
	}
}
