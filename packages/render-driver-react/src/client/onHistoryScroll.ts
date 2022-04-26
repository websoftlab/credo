import type { OnPageHook } from "../app";
import type { Api } from "@credo-js/app";
import type { ElementType } from "react";
import type {OnPageHistoryScrollHook} from "../app/types";
import createEvent from "./createEvent";

type ScrollXY = {
	x: number;
	y: number;
};

function historySave(__scroll?: ScrollXY) {
	if (__scroll == null) {
		__scroll = { x: window.scrollX, y: window.scrollY };
	}

	// floor values 0.000.1 -> 0
	__scroll.x = __scroll.x >> 0;
	__scroll.y = __scroll.y >> 0;

	const prev = history.state?.__scroll;
	if (prev && prev.x === __scroll.x && prev.y === __scroll.y) {
		return;
	}

	history.replaceState({ ...history.state, __scroll }, document.title);
}

export default function onHistoryScroll(api: Api<ElementType>) {
	const { history: historyService } = api.services;
	if (!historyService) {
		return;
	}

	const history = window.history;
	if (history.scrollRestoration) {
		history.scrollRestoration = "manual";
	}

	let lastMountKey = "";

	function onPageMount(e: OnPageHook & { name: string }) {
		const key = e.history.location.key;

		// ignore remount
		if (!key || key === lastMountKey) {
			return;
		}

		lastMountKey = key;

		const action = e.history.action;
		const goTo: ScrollXY = {
			x: 0,
			y: 0,
		};

		if (action === "POP") {
			const xy = history.state?.__scroll;
			if (xy != null) {
				if (e.name === "onPageMount") {
					goTo.x = xy.x;
					goTo.y = xy.y;
				}
			}
		}

		const event = createEvent({
			scroll: goTo,
		});

		api.emit<OnPageHistoryScrollHook>("onPageHistoryScroll", event);
		if(!event.defaultPrevented) {
			window.scroll(goTo.x, goTo.y);
			historySave(goTo);
		}
	}

	let lastSave = Date.now();
	let lastUpdate = Date.now();
	let id = 0;

	function tick() {
		if (!id) {
			id = window.setTimeout(checkSave, 200);
		}
	}

	function checkSave() {
		id = 0;
		const now = Date.now();
		if (now - lastUpdate > 300 || now - lastSave > 3000) {
			lastSave = now;
			lastUpdate = now;
			historySave();
		} else {
			tick();
		}
	}

	window.addEventListener("scroll", () => {
		lastUpdate = Date.now();
		tick();
	});

	historyService.block((_, action) => {
		if (action === "PUSH") {
			historySave();
		}
	});

	api.subscribe<OnPageHook>(["onPageMount", "onPageError"], onPageMount);
}
