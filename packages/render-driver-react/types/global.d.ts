import type { API } from "@phragon/app";
import type { Root } from "react-dom/client";
import type { Api } from "@phragon/app";
import type {
	OnLocationChangeHook,
	OnAppMountHook,
	OnPageTitleHook,
	OnPageMountHook,
	OnPageErrorHook,
	OnAppRenderHook,
	OnPageHistoryScrollHook,
	OnPageAnchorClickHook,
	OnPageClickHook,
	OnBeforeNavigateHook,
	OnBeforeHistoryNavigateHook,
	Navigator,
} from "@phragon/render-driver-react/app/index";

declare global {
	interface Window {
		api: Api;
	}
}

declare module "@phragon/app" {
	class Api<ComponentType, Store = any> implements API.ApiInterface<ComponentType> {
		root?: Root;
		hasHistoryScroll?: boolean;
	}
	namespace API {
		interface Services {
			navigator?: Navigator;
		}

		interface ApiInterface<ComponentType, State = any> extends Record<string, any> {
			root?: Root;
			hasHistoryScroll?: boolean;

			subscribe(action: "onRender", listener: API.HookListener<OnAppRenderHook>): API.HookUnsubscribe;
			subscribe(action: "onPageTitle", listener: API.HookListener<OnPageTitleHook>): API.HookUnsubscribe;
			subscribe(action: "onPageMount", listener: API.HookListener<OnPageMountHook>): API.HookUnsubscribe;
			subscribe(action: "onPageError", listener: API.HookListener<OnPageErrorHook>): API.HookUnsubscribe;
			subscribe(action: "onMount", listener: API.HookListener<OnAppMountHook>): API.HookUnsubscribe;
			subscribe(
				action: "onLocationChange",
				listener: API.HookListener<OnLocationChangeHook>
			): API.HookUnsubscribe;
			subscribe(
				action: "onPageHistoryScroll",
				listener: API.HookListener<OnPageHistoryScrollHook>
			): API.HookUnsubscribe;
			subscribe(action: "onPageClick", listener: API.HookListener<OnPageClickHook>);
			subscribe(action: "onPageAnchorClick", listener: API.HookListener<OnPageAnchorClickHook>);
			subscribe(action: "onBeforeNavigate", listener: API.HookListener<OnBeforeNavigateHook>);
			subscribe(action: "onBeforeNavigateHistory", listener: API.HookListener<OnBeforeHistoryNavigateHook>);

			once(action: "onRender", listener: API.HookListener<OnAppRenderHook>): API.HookUnsubscribe;
			once(action: "onPageTitle", listener: API.HookListener<OnPageTitleHook>): API.HookUnsubscribe;
			once(action: "onPageMount", listener: API.HookListener<OnPageMountHook>): API.HookUnsubscribe;
			once(action: "onPageError", listener: API.HookListener<OnPageErrorHook>): API.HookUnsubscribe;
			once(action: "onMount", listener: API.HookListener<OnAppMountHook>): API.HookUnsubscribe;
			once(action: "onLocationChange", listener: API.HookListener<OnLocationChangeHook>): API.HookUnsubscribe;
			once(
				action: "onPageHistoryScroll",
				listener: API.HookListener<OnPageHistoryScrollHook>
			): API.HookUnsubscribe;
			once(action: "onPageClick", listener: API.HookListener<OnPageClickHook>);
			once(action: "onPageAnchorClick", listener: API.HookListener<OnPageAnchorClickHook>);
			once(action: "onBeforeNavigate", listener: API.HookListener<OnBeforeNavigateHook>);
			once(action: "onBeforeNavigateHistory", listener: API.HookListener<OnBeforeHistoryNavigateHook>);

			emit(action: "onRender", event: OnAppRenderHook): void;
			emit(action: "onPageTitle", event: OnPageTitleHook): void;
			emit(action: "onPageMount", event: OnPageMountHook): void;
			emit(action: "onPageError", event: OnPageErrorHook): void;
			emit(action: "onMount", event: OnAppMountHook): void;
			emit(action: "onLocationChange", event: OnLocationChangeHook): void;
			emit(action: "onPageHistoryScroll", event: OnPageHistoryScrollHook): void;
			emit(action: "onPageClick", event: OnPageClickHook): void;
			emit(action: "onPageAnchorClick", event: OnPageAnchorClickHook): void;
			emit(action: "onBeforeNavigate", event: OnBeforeNavigateHook): void;
			emit(action: "onBeforeHistoryNavigate", event: OnBeforeHistoryNavigateHook): void;
		}
	}
}
