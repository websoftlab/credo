import type {
	Navigator,
	NavigateOptions,
	OnPageHistoryScrollHook,
	OnBeforeNavigateHook,
	OnBeforeHistoryNavigateHook,
} from "../app";
import type { To, History } from "history";
import type { ElementType } from "react";
import type { Api } from "@phragon/app";
import { createBrowserHistory } from "history";
import { createEvent } from "../app/utils";

const HKey = Symbol("navigator.history");

export function createNavigator(api: Api<ElementType>): Navigator {
	const history = createBrowserHistory({ window });
	const recall =
		(replace: boolean) =>
		(to: To, options: NavigateOptions = {}) => {
			const { state = {}, scroll = true } = options;
			const event: OnBeforeNavigateHook = createEvent({
				to,
				replace,
				state,
				scroll,
			});
			api.emit("onBeforeNavigate", event);
			if (event.defaultPrevented) {
				return;
			}
			if (!event.scroll && api.hasHistoryScroll) {
				api.once<OnPageHistoryScrollHook>("onPageHistoryScroll", (e) => {
					e.preventDefault();
				});
			}
			(event.replace ? history.replace : history.push)(event.to, event.state);
		};
	const isGo = (delta: number, action: "go" | "back" | "forward") => {
		const event: OnBeforeHistoryNavigateHook = createEvent({
			delta,
			action,
		});
		api.emit("onBeforeHistoryNavigate", event);
		return !event.defaultPrevented;
	};

	return {
		[HKey]: history,
		push: recall(false),
		replace: recall(true),
		createHref(to: To): string {
			return history.createHref(to);
		},
		go(delta: number) {
			if (isGo(delta, "go")) {
				history.go(delta);
			}
		},
		back() {
			if (isGo(-1, "back")) {
				history.back();
			}
		},
		forward() {
			if (isGo(1, "forward")) {
				history.forward();
			}
		},
	};
}

export function getHistory(navigator: Navigator): History {
	return navigator[HKey];
}
