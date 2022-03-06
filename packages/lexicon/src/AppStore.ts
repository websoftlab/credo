import {action, flow, makeObservable, observable} from "mobx";
import {load, reload} from "./lexicon";
import createTranslator from "./createTranslator";
import type {Lexicon} from "./types";

function lang(this: AppStore, data: Lexicon.Data) {
	const {id, lexicon, lambda, packages} = data;
	this.language = id;
	this.lexicon = lexicon;
	this.lambda = lambda;
	this.packages = packages;
}

export default class AppStore<State = any> implements Lexicon.StoreInterface<State> {

	public state: any = {};
	public language: string = "en";
	public lexicon: any = {};
	public lambda: Record<string, Lexicon.LambdaTranslate> = {};
	public packages: string[] = [];

	readonly translator!: Lexicon.Translator;

	constructor(state?: any) {
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

		// load state from page
		if(state) {
			this.state = state;
		}

		const translator = createTranslator(this);
		Object.defineProperty(this, "translator", {
			get() {
				return translator;
			}
		});
	}

	update(state: any) {
		Object.assign(this.state, state);
	}

	translate(key: string, alternative?: string) {
		let value = this.lexicon[key];
		if(value != null) {
			return value;
		}
		value = this.state[key];
		if(value != null) {
			return value;
		}
		return alternative == null ? key : alternative;
	}

	* reloadLanguage(id: string) {
		return reload(id)
			.then((data: Lexicon.Data) => {
				lang.call(this, data);
			});
	}

	* loadLanguage(id: string, packageName?: string) {
		return load(id, packageName)
			.then((data: Lexicon.Data) => {
				lang.call(this, data);
			});
	}
}
