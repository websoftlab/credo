import { action, flow, makeObservable, observable } from "mobx";
import { LanguageStore } from "@phragon/lexicon";
import { isPlainObject } from "@phragon/utils";
import type { App } from "./types";

function merge(main: any, state: any) {
	const keys = Object.keys(state);
	for (const key of keys) {
		const value = state[key];
		if (main[key] === value) {
			continue;
		}
		if (main.hasOwnProperty(key) && isPlainObject(main[key]) && isPlainObject(value)) {
			merge(main[key], value);
		} else {
			main[key] = value;
		}
	}
}

export default class AppStore<State = any> extends LanguageStore implements App.StoreInterface<State> {
	public state: any;
	private readonly _initialState: any;
	private readonly _additionalState: any;

	constructor(state?: any) {
		super();

		if (!state) {
			state = {};
		}

		this.state = state;
		this._initialState = state;
		this._additionalState = {};

		makeObservable(this, {
			state: observable,
			language: observable,
			lexicon: observable,
			lambda: observable,
			packages: observable,
			setLanguageData: action,
			update: action,
			reload: action,
			loadLanguage: flow,
			reloadLanguage: flow,
		});
	}

	update(state: any) {
		if (isPlainObject(state)) {
			merge(this._additionalState, state);
			merge(this.state, this._additionalState);
		} else {
			throw new Error("Application state should be a plain object");
		}
	}

	reload(state: any, init: boolean = false) {
		if (isPlainObject(state)) {
			if (init) {
				merge(this._initialState, state);
			}
			this.state = { ...this._initialState };
			if (!init) {
				merge(this.state, state);
			}
			merge(this.state, this._additionalState);
		} else {
			throw new Error("Application state should be a plain object");
		}
	}

	translate(key: string, alternative?: string | ((key: string) => string)) {
		if (typeof this.state[key] === "string") {
			return this.state[key];
		}
		return super.translate(key, alternative);
	}
}
