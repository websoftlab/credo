import { action, flow, makeObservable, observable } from "mobx";
import { LanguageStore } from "@phragon/lexicon";
import type { App } from "./types";

export default class AppStore<State = any> extends LanguageStore implements App.StoreInterface<State> {
	public state: any;

	constructor(state?: any) {
		super();

		this.state = state || {};

		makeObservable(this, {
			state: observable,
			language: observable,
			lexicon: observable,
			lambda: observable,
			packages: observable,
			update: action,
			loadLanguage: flow,
			reloadLanguage: flow,
		});
	}

	update(state: any) {
		Object.assign(this.state, state);
	}

	translate(key: string, alternative?: string | ((key: string) => string)) {
		if (typeof this.state[key] === "string") {
			return this.state[key];
		}
		return super.translate(key, alternative);
	}
}
