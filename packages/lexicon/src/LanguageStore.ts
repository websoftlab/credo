import createTranslator from "./createTranslator";
import {reload, load} from "./lexicon";
import type {Lexicon} from "./types";

function lang(this: LanguageStore, data: Lexicon.Data) {
	const {id, lexicon, lambda, packages} = data;
	this.language = id;
	this.lexicon = lexicon;
	this.lambda = lambda;
	this.packages = packages;
}

export default class LanguageStore implements Lexicon.LanguageStoreInterface {

	readonly translator!: Lexicon.Translator;

	constructor(
		public language: string = "en",
		public lexicon: any = {},
		public lambda: Record<string, Lexicon.LambdaTranslate> = {},
		public packages: string[] = []
	) {
		const translator = createTranslator(this);
		Object.defineProperty(this, "translator", {
			configurable: false,
			get() {
				return translator;
			}
		});
	}

	translate(key: string, alternative?: string | ((key: string) => string)) {
		if(this.lexicon.hasOwnProperty(key)) {
			return this.lexicon[key];
		}
		if(typeof alternative === "function") {
			return alternative(key);
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
