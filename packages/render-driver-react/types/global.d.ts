import type { API } from "@credo-js/app";
import type { History } from "history";
import type {
	OnLocationChangeHook,
	OnAppMountHook,
	OnPageTitleHook,
	OnPageHook,
	OnAppRenderHook,
	OnPageHistoryScrollHook,
} from "@credo-js/render-driver-react/app/index";

declare module "@credo-js/app" {
	namespace API {
		interface Services {
			history?: History;
		}

		interface ApiInterface<ComponentType, State = any> extends Record<string, any> {
			subscribe(action: "onRender", listener: API.HookListener<OnAppRenderHook>): API.HookUnsubscribe;
			subscribe(action: "onPageTitle", listener: API.HookListener<OnPageTitleHook>): API.HookUnsubscribe;
			subscribe(action: "onPageMount", listener: API.HookListener<OnPageHook>): API.HookUnsubscribe;
			subscribe(action: "onPageError", listener: API.HookListener<OnPageHook>): API.HookUnsubscribe;
			subscribe(action: "onMount", listener: API.HookListener<OnAppMountHook>): API.HookUnsubscribe;
			subscribe(
				action: "onLocationChange",
				listener: API.HookListener<OnLocationChangeHook>
			): API.HookUnsubscribe;
			subscribe(
				action: "onPageHistoryScroll",
				listener: API.HookListener<OnPageHistoryScrollHook>
			): API.HookUnsubscribe;

			once(action: "onRender", listener: API.HookListener<OnAppRenderHook>): API.HookUnsubscribe;
			once(action: "onPageTitle", listener: API.HookListener<OnPageTitleHook>): API.HookUnsubscribe;
			once(action: "onPageMount", listener: API.HookListener<OnPageHook>): API.HookUnsubscribe;
			once(action: "onPageError", listener: API.HookListener<OnPageHook>): API.HookUnsubscribe;
			once(action: "onMount", listener: API.HookListener<OnAppMountHook>): API.HookUnsubscribe;
			once(action: "onLocationChange", listener: API.HookListener<OnLocationChangeHook>): API.HookUnsubscribe;
			once(
				action: "onPageHistoryScroll",
				listener: API.HookListener<OnPageHistoryScrollHook>
			): API.HookUnsubscribe;

			emit(action: "onRender", event: OnAppRenderHook): void;
			emit(action: "onPageTitle", event: OnPageTitleHook): void;
			emit(action: "onPageMount", event: OnPageHook): void;
			emit(action: "onPageError", event: OnPageHook): void;
			emit(action: "onMount", event: OnAppMountHook): void;
			emit(action: "onLocationChange", event: OnLocationChangeHook): void;
			emit(action: "onPageHistoryScroll", event: OnPageHistoryScrollHook): void;
		}
	}
}
