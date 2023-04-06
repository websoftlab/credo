import type { Context, Next } from "koa";
import type { PatternInterface } from "@phragon/path-to-pattern";
import type { HttpPage } from "@phragon/responder-page";

export namespace Dashboard {
	export type BadgeType = number | string | [string, string] | [number, string] | undefined;

	export type ButtonVariantType<Type extends string = string> = Type;

	export type Action<Name extends string = string, Props = any> =
		| Name
		| [Name, Props]
		| {
				name: Name;
				props: Props;
		  };

	export interface LinkAction {
		id: string;
		name: string;
		to?: string;
		action?: Action;
	}

	export interface MenuAction extends LinkAction {
		icon?: string;
		active?: boolean;
		disabled?: boolean;
	}

	export interface MainMenuAction extends MenuAction {
		badge?: BadgeType;
	}

	export interface ButtonAction extends LinkAction {
		icon?: string;
		variant?: ButtonVariantType;
		disabled?: boolean;
	}

	export interface MenuActionGroup {
		id: string;
		name: string;
		menu: MenuAction[];
	}

	export interface ShortcutAction extends Omit<ButtonAction, "icon"> {
		icon: string;
		active?: boolean;
		badge?: BadgeType;
	}

	export interface PluginController<R = any> {
		(ctx: Context): R | Promise<R>;
	}

	export interface PluginApiController extends PluginController<APIResponse> {}
	export interface PluginWebController extends PluginController<WebResponse> {}
	export interface PluginRawController extends PluginController<void> {}

	export interface PluginWebErrorController {
		(ctx: Context, error: Error): WebResponse | Promise<WebResponse>;
	}

	export interface PluginMiddleware {
		(ctx: Context, next: Next): void | Promise<void>;
	}

	export interface PluginOnRequestCallback {
		(ctx: Context): void | Promise<void>;
	}

	export interface PluginControllerRule<Ctr extends PluginController> {
		name: string;
		path?: string;
		method?: string | string[];
		controller: Ctr;
	}

	export interface Plugin {
		api?: PluginApiController | PluginControllerRule<PluginApiController>[];
		raw?: PluginRawController | PluginControllerRule<PluginRawController>[];
		web?: PluginWebController | Omit<PluginControllerRule<PluginWebController>, "method">[];
		middleware?: PluginMiddleware | PluginMiddleware[];
		onRequest?: PluginOnRequestCallback;
	}

	export interface PluginContext<Detail = any> {
		name: string;
		mode: "web" | "api" | "raw";
		details: Detail;
	}

	export interface APIResponse<Payload = any> {
		ok: boolean;
		codeName?: string;
		message?: string;
		payload?: Payload;
		actions?: Action[];
	}

	export interface WebResponseData<Ctx extends {} = {}> {
		title: string;
		menu?: MainMenuAction[];
		shortcutMenu?: ShortcutAction[];
		subMenu?: MenuActionGroup[];
		component?: Component | Component[];
		context?: Ctx;
	}

	export type WebResponse =
		| WebResponseData
		| { code: number; data: WebResponseData }
		| { code: number; response: { data: any; page: string; props?: any } }
		| HttpPage<WebResponseData>;

	export interface Component<P extends {} = any> {
		id: string;
		name: string;
		props?: P;
		divider?: boolean;
		bottom?: boolean;
	}
}

export interface DashboardUserProfile<Detail = {}> {
	id: number | string;
	name: string;
	login: string;
	detail?: Detail;
}

export interface DashboardPanel {
	readonly web: PatternInterface;
	readonly api: PatternInterface;
	readonly raw: PatternInterface;
	readonly patterns: Record<string, string>;
	readonly path: string;
	pluginDefined(name: string): boolean;
	pluginDetail<T extends {} = {}>(name: string): T;
	definePlugin(name: string, plugin: Dashboard.Plugin, options?: any): void;
	defineHomePageController(controller: Dashboard.PluginWebController): void;
	defineErrorController(controller: Dashboard.PluginWebErrorController): void;
}

export interface DashboardStoreState<UserDetail = {}, Ext extends {} = {}> {
	dashboard?: Ext & {
		icon?: string;
		title?: string;
		path?: string;
		patterns?: Record<string, string>;
		menu?: Dashboard.MainMenuAction[];
		shortcutMenu?: Dashboard.ShortcutAction[];
		user?: DashboardUserProfile<UserDetail> | null;
	};
}

export interface DashboardPanel {
	readonly web: PatternInterface;
	readonly api: PatternInterface;
	pluginDefined(name: string): boolean;
	pluginDetail<T extends {} = {}>(name: string): T;
	definePlugin(name: string, plugin: Dashboard.Plugin, options?: any): void;
	defineHomePageController(controller: Dashboard.PluginWebController): void;
	defineErrorController(controller: Dashboard.PluginWebErrorController): void;
}
