import { action, flow, makeObservable, observable } from "mobx";
import { LanguageStore } from "@phragon/lexicon";
import { isPlainObject } from "@phragon-util/plain-object";
import type { App } from "./types";

function merge(main: any, state: any, removeNotExists = false) {
	const keys = Object.keys(state);
	for (const key of keys) {
		const value = state[key];
		if (main[key] === value) {
			continue;
		}
		if (main.hasOwnProperty(key) && isPlainObject(main[key]) && isPlainObject(value)) {
			merge(main[key], value, removeNotExists);
		} else {
			main[key] = value;
		}
	}

	// remove not exists value
	if (removeNotExists) {
		for (const key of Object.keys(main)) {
			if (!keys.includes(key)) {
				delete main[key];
			}
		}
	}
}

function lexicon(store: AppStore, key: string) {
	const lx = store.state.lexion;
	return lx && lx.hasOwnProperty(key) ? lx[key] : null;
}

export default class AppStore<State = any> extends LanguageStore implements App.StoreInterface<State> {
	public state: any;
	public readonly version: string = "1.0.0";
	public readonly build: string | null = null;
	private readonly _initialState: any;
	private readonly _additionalState: any;

	constructor(state?: any) {
		super();

		if (!state) {
			state = {};
		} else {
			if (typeof state.buildVersion === "string") {
				this.version = state.buildVersion;
			}
			if (typeof state.buildId === "string") {
				this.build = state.buildId;
			}
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
			// update initial state
			if (init) {
				merge(this._initialState, state);
			}

			// fill initial state
			merge(this.state, this._initialState, true);
			if (!init) {
				merge(this.state, state);
			}

			// add additional state
			merge(this.state, this._additionalState);
		} else {
			throw new Error("Application state should be a plain object");
		}
	}

	line<Val = string>(key: string): Val | null {
		const value = lexicon(this, key);
		return value == null ? super.line(key) : value;
	}

	translate<Val = string>(key: string, alternative?: Val | ((key: string) => Val)) {
		const value = lexicon(this, key);
		return value == null ? super.translate(key, alternative) : value;
	}
}
